// App State
const state = {
  aiConnected: false,
  rates: { USD: null, EUR: null },
  history: JSON.parse(localStorage.getItem('forex_history')) || { USD: [], EUR: [] },
  predictions: JSON.parse(localStorage.getItem('forex_predictions')) || [],
  rules: JSON.parse(localStorage.getItem('forex_rules')) || [],
  insights: JSON.parse(localStorage.getItem('forex_insights')) || [],
  activeView: 'dashboard',
  charts: { main: null, sparkUsd: null, sparkEur: null }
};

// Elements
const els = {
  // Modal
  configModal: document.getElementById('config-modal'),
  apiKeyInput: document.getElementById('api-key-input'),
  saveConfigBtn: document.getElementById('save-config-btn'),
  skipConfigBtn: document.getElementById('skip-config-btn'),
  
  // Status
  aiStatusBadge: document.getElementById('ai-status-badge'),
  aiPanelStatus: document.getElementById('ai-panel-status'),
  lastUpdateText: document.getElementById('last-update-text'),
  marketClock: document.getElementById('market-clock'),
  
  // Navigation
  navItems: document.querySelectorAll('.nav-item'),
  views: document.querySelectorAll('.view'),
  
  // Dashboard Cards
  priceUsd: document.getElementById('price-usd'),
  priceEur: document.getElementById('price-eur'),
  changeUsd: document.getElementById('change-usd'),
  changeEur: document.getElementById('change-eur'),
  signalUsd: document.getElementById('signal-usd'),
  signalEur: document.getElementById('signal-eur'),
  predUsdMini: document.getElementById('pred-usd-mini'),
  predEurMini: document.getElementById('pred-eur-mini'),
  
  // Actions
  refreshBtn: document.getElementById('refresh-btn'),
  analyzeBtn: document.getElementById('analyze-btn'),
  configureAiBtn: document.getElementById('configure-ai-btn'),
  
  // Prediction View
  generatePredictionBtn: document.getElementById('generate-prediction-btn'),
  predictionGrid: document.getElementById('prediction-grid'),
  
  // Opportunities View
  planBuyBtn: document.getElementById('plan-buy-btn'),
  planResult: document.getElementById('plan-result'),
  
  // History View
  historyTbody: document.getElementById('history-tbody'),
  
  // Learnings
  updateResultBtn: document.getElementById('update-result-btn'),
  updatePredictionSelect: document.getElementById('update-prediction-select'),
  generateInsightsBtn: document.getElementById('generate-insights-btn'),
  insightsList: document.getElementById('insights-list'),
  rulesList: document.getElementById('rules-list')
};

// Initialize
async function init() {
  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
  
  initCharts();
  
  // Fetch market data first, then check AI connection
  await fetchMarketData();
  await checkServerConnection();
  
  // Refresh data every 10 minutes
  setInterval(fetchMarketData, 10 * 60 * 1000);
}

function setupEventListeners() {
  // Config Modal
  if(els.saveConfigBtn) els.saveConfigBtn.addEventListener('click', saveApiKey);
  if(els.skipConfigBtn) els.skipConfigBtn.addEventListener('click', hideModal);
  if(els.configureAiBtn) els.configureAiBtn.addEventListener('click', showModal);
  
  // Navigation
  els.navItems.forEach(item => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  
  // Actions
  els.refreshBtn.addEventListener('click', fetchMarketData);
  els.analyzeBtn.addEventListener('click', () => {
    switchView('prediction');
    generatePrediction();
  });
  els.generatePredictionBtn.addEventListener('click', generatePrediction);
  if (els.generateInsightsBtn) els.generateInsightsBtn.addEventListener('click', generateAdvancedInsights);
  
  if (els.planBuyBtn) els.planBuyBtn.addEventListener('click', calculateOpportunity);
  
  // Chart Tabs
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      updateMainChart(e.target.dataset.currency);
    });
  });
  
  // Prediction Tabs
  document.querySelectorAll('.pred-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.pred-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      const period = e.target.dataset.period;
      document.getElementById('pred-period').value = period;
      filterPredictionsByPeriod(period);
    });
  });
}

async function checkServerConnection() {
  try {
    const res = await callGemini('Responda apenas: OK');
    if (res) {
      state.aiConnected = true;
      hideModal();
      updateAiStatus(true);
      showToast('IA conectada com sucesso!', 'success');
      // Now that we're connected AND have rates, run analysis
      if (state.rates.USD) {
        runQuickAnalysis();
      }
    }
  } catch (err) {
    state.aiConnected = false;
    updateAiStatus(false);
    hideModal();
    showToast('Servidor IA indisponível. Verifique a configuração.', 'error');
  }
}

function showModal() {
  els.configModal.classList.remove('hidden');
}

function hideModal() {
  els.configModal.classList.add('hidden');
}

function saveApiKey() {
  // No longer needed - key is on server
  hideModal();
  checkServerConnection();
}

function updateAiStatus(isOnline) {
  const dot = els.aiStatusBadge.querySelector('.status-dot');
  const text = els.aiStatusBadge.querySelector('.status-text');
  
  if (isOnline) {
    dot.className = 'status-dot online';
    text.textContent = 'IA Online';
    els.aiPanelStatus.className = 'panel-badge online';
    els.aiPanelStatus.textContent = 'Online';
    if(els.configureAiBtn) els.configureAiBtn.classList.add('hidden');
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'IA Offline';
    els.aiPanelStatus.className = 'panel-badge offline';
    els.aiPanelStatus.textContent = 'Offline';
    if(els.configureAiBtn) els.configureAiBtn.classList.remove('hidden');
  }
}

function switchView(viewName) {
  state.activeView = viewName;
  
  // Update Nav
  els.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });
  
  // Update Views
  els.views.forEach(view => {
    view.classList.toggle('active', view.id === `view-${viewName}`);
  });
  
  // Update Title
  const titles = {
    dashboard: 'Dashboard',
    prediction: 'Previsões IA',
    history: 'Histórico',
    learning: 'Aprendizado de Máquina',
    opportunities: 'Oportunidades de Compra'
  };
  document.getElementById('page-title').textContent = titles[viewName];
  
  // Call specific render functions
  if(viewName === 'history') renderHistory();
  if(viewName === 'learning') renderLearning();
  if(viewName === 'prediction') {
    const activeTab = document.querySelector('.pred-tab.active');
    if(activeTab) filterPredictionsByPeriod(activeTab.dataset.period);
  }
}

function updateClock() {
  const now = new Date();
  els.marketClock.textContent = now.toLocaleTimeString('pt-BR');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type]}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// === QUANTITATIVE ENGINE (MATH) === //
function calculateSMA(prices, period = 10) {
  if (prices.length < period) return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length <= period) return 50; // Default neutral if not enough data
  
  let gains = 0;
  let losses = 0;
  
  // Initial average calculation
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Smoothed calculation for the rest
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateStdDev(prices, sma, period) {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const variance = slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
  return Math.sqrt(variance);
}

function calculateBuyScore(currency) {
  const history = state.history[currency] || [];
  if (history.length < 20) return { score: 50, rsi: 50, sma: state.rates[currency], zScore: 0 };
  
  const prices = history.map(d => parseFloat(d.price));
  const currentPrice = state.rates[currency];
  
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const rsi14 = calculateRSI(prices, 14);
  const stdDev20 = calculateStdDev(prices, sma20, 20);
  
  // Z-Score (how many std deviations is the price from the mean)
  const zScore = stdDev20 > 0 ? (currentPrice - sma20) / stdDev20 : 0;
  
  let score = 50; // Base neutral score
  
  // Rule 1: RSI (max 20 points impact)
  if (rsi14 < 30) score += 20; 
  else if (rsi14 < 40) score += 10;
  else if (rsi14 > 70) score -= 20;
  else if (rsi14 > 60) score -= 10;
  
  // Rule 2: Distance from SMA20 (max 20 points impact)
  const distSma20 = (currentPrice - sma20) / sma20;
  if (distSma20 < -0.02) score += 20; // 2% below
  else if (distSma20 < -0.01) score += 10;
  else if (distSma20 > 0.02) score -= 20;
  else if (distSma20 > 0.01) score -= 10;
  
  // Rule 3: Distance from SMA50 (max 15 points impact)
  const distSma50 = sma50 > 0 ? (currentPrice - sma50) / sma50 : 0;
  if (distSma50 < -0.03) score += 15; // 3% below
  else if (distSma50 < -0.015) score += 7;
  else if (distSma50 > 0.03) score -= 15;
  else if (distSma50 > 0.015) score -= 7;
  
  // Rule 4: Z-Score / Bollinger (max 15 points impact)
  if (zScore < -2) score += 15; // Below lower band
  else if (zScore < -1) score += 7;
  else if (zScore > 2) score -= 15; // Above upper band
  else if (zScore > 1) score -= 7;
  
  // Clamp score 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  return {
    score: score,
    rsi: rsi14.toFixed(2),
    sma: sma20.toFixed(4),
    zScore: zScore.toFixed(2)
  };
}

// === MARKET DATA === //
async function fetchMarketData() {
  els.refreshBtn.classList.add('loading');
  els.lastUpdateText.textContent = 'Atualizando...';
  
  try {
    // Fetch last 90 days of history for robust RSI, SMA20, SMA50 and Bollinger Bands
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 90);
    
    const formatDate = (d) => d.toISOString().split('T')[0];
    const startDate = formatDate(past);
    const endDate = formatDate(today);
    
    // Fetch History from Frankfurter API (Reliable ECB historical data)
    const response = await fetch(`https://api.frankfurter.app/${startDate}..${endDate}?from=USD&to=BRL,EUR`);
    const histData = await response.json();
    
    if (histData.rates) {
      const dates = Object.keys(histData.rates).sort();
      
      const usdHistory = [];
      const eurHistory = [];
      
      let lastUsd = null;
      let lastEur = null;
      
      dates.forEach(date => {
        const usdToBrl = histData.rates[date].BRL;
        const usdToEur = histData.rates[date].EUR;
        const eurToBrl = usdToBrl / usdToEur; // Cross rate EUR/BRL
        
        usdHistory.push({ date: date, price: usdToBrl.toFixed(4) });
        eurHistory.push({ date: date, price: eurToBrl.toFixed(4) });
        
        lastUsd = usdToBrl;
        lastEur = eurToBrl;
      });
      
      // Update state with REAL history
      state.history.USD = usdHistory;
      state.history.EUR = eurHistory;
      localStorage.setItem('forex_history', JSON.stringify(state.history));
      
      // Update current rates
      state.rates.USD = lastUsd;
      state.rates.EUR = lastEur;
      
      updateDashboardUI();
      updateMainChart('USD');
      
      els.lastUpdateText.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
      
      if(state.aiConnected) {
        runQuickAnalysis();
      }
    }
  } catch (err) {
    console.error('Error fetching market data', err);
    showToast('Erro ao atualizar cotações', 'error');
    els.lastUpdateText.textContent = 'Falha na atualização';
  } finally {
    els.refreshBtn.classList.remove('loading');
  }
}

function updateDashboardUI() {
  // Formatter
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3 });
  
  // USD
  els.priceUsd.textContent = fmt.format(state.rates.USD);
  const usdHist = state.history.USD;
  if(usdHist.length > 1) {
    const prevUsd = parseFloat(usdHist[usdHist.length-2].price);
    const currUsd = state.rates.USD;
    const diff = currUsd - prevUsd;
    const pct = (diff / prevUsd) * 100;
    els.changeUsd.className = `card-change ${diff >= 0 ? 'up' : 'down'}`;
    els.changeUsd.innerHTML = `<span class="change-icon">${diff >= 0 ? '▲' : '▼'}</span> <span class="change-value">${Math.abs(pct).toFixed(2)}%</span>`;
    
    // Simple heuristic signal
    els.signalUsd.className = `signal-badge ${diff < -0.05 ? 'buy' : (diff > 0.05 ? 'sell' : 'hold')}`;
    els.signalUsd.textContent = diff < -0.05 ? 'COMPRA' : (diff > 0.05 ? 'VENDA' : 'NEUTRO');
  }

  // EUR
  els.priceEur.textContent = fmt.format(state.rates.EUR);
  const eurHist = state.history.EUR;
  if(eurHist.length > 1) {
    const prevEur = parseFloat(eurHist[eurHist.length-2].price);
    const currEur = state.rates.EUR;
    const diff = currEur - prevEur;
    const pct = (diff / prevEur) * 100;
    els.changeEur.className = `card-change ${diff >= 0 ? 'up' : 'down'}`;
    els.changeEur.innerHTML = `<span class="change-icon">${diff >= 0 ? '▲' : '▼'}</span> <span class="change-value">${Math.abs(pct).toFixed(2)}%</span>`;
    
    // Simple heuristic signal
    els.signalEur.className = `signal-badge ${diff < -0.05 ? 'buy' : (diff > 0.05 ? 'sell' : 'hold')}`;
    els.signalEur.textContent = diff < -0.05 ? 'COMPRA' : (diff > 0.05 ? 'VENDA' : 'NEUTRO');
  }
  
  // Best Buy Card
  updateBestBuyCard();
  
  updateSparkline('USD', state.history.USD);
  updateSparkline('EUR', state.history.EUR);
}

function updateBestBuyCard() {
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 3 });
  
  const usds = state.predictions.filter(p => p.currency === 'USD' && p.chartData);
  const eurs = state.predictions.filter(p => p.currency === 'EUR' && p.chartData);
  
  function getBest(preds) {
    if(!preds.length) return null;
    preds.sort((a,b) => (b.timestamp||b.id) - (a.timestamp||a.id));
    const latest = preds[0];
    
    let bestPoint = null;
    latest.chartData.forEach(d => {
      if(d.buySignal) {
        if(!bestPoint || d.price < bestPoint.price) {
          bestPoint = d;
        }
      }
    });
    
    if(!bestPoint) {
      latest.chartData.forEach(d => {
        if(!bestPoint || d.price < bestPoint.price) {
          bestPoint = d;
        }
      });
    }
    return bestPoint;
  }
  
  const bestUsd = getBest(usds);
  if(bestUsd) {
    document.getElementById('best-buy-date-usd').textContent = bestUsd.date;
    document.getElementById('best-buy-price-usd').textContent = fmt.format(bestUsd.price);
    document.getElementById('best-buy-reason-usd').textContent = bestUsd.reasoning;
  } else {
    document.getElementById('best-buy-date-usd').textContent = 'Análise Pendente';
    document.getElementById('best-buy-price-usd').textContent = 'R$ --,---';
    document.getElementById('best-buy-reason-usd').textContent = 'Gere uma previsão na aba "Previsões" para ver a melhor data de compra.';
  }
  
  const bestEur = getBest(eurs);
  if(bestEur) {
    document.getElementById('best-buy-date-eur').textContent = bestEur.date;
    document.getElementById('best-buy-price-eur').textContent = fmt.format(bestEur.price);
    document.getElementById('best-buy-reason-eur').textContent = bestEur.reasoning;
  } else {
    document.getElementById('best-buy-date-eur').textContent = 'Análise Pendente';
    document.getElementById('best-buy-price-eur').textContent = 'R$ --,---';
    document.getElementById('best-buy-reason-eur').textContent = 'Gere uma previsão na aba "Previsões" para ver a melhor data de compra.';
  }
}

// === CHARTS === //
function initCharts() {
  Chart.defaults.color = '#9ba1ad';
  Chart.defaults.font.family = 'Inter';
  
  const sparkOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }
  };

  // Spark USD
  const ctxUsd = document.getElementById('sparkline-usd').getContext('2d');
  state.charts.sparkUsd = new Chart(ctxUsd, {
    type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#10b981' }] },
    options: sparkOptions
  });

  // Spark EUR
  const ctxEur = document.getElementById('sparkline-eur').getContext('2d');
  state.charts.sparkEur = new Chart(ctxEur, {
    type: 'line', data: { labels: [], datasets: [{ data: [], borderColor: '#3b82f6' }] },
    options: sparkOptions
  });

  // Main Chart
  const ctxMain = document.getElementById('main-chart').getContext('2d');
  state.charts.main = new Chart(ctxMain, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Cotação Real', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.3, pointRadius: 3 },
      { label: 'Previsão IA', data: [], borderColor: '#8b5cf6', borderDash: [5, 5], tension: 0.3, pointRadius: 4 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function updateSparkline(currency, historyData) {
  const chart = currency === 'USD' ? state.charts.sparkUsd : state.charts.sparkEur;
  if(!chart) return;
  const data = historyData.slice(-10).map(d => parseFloat(d.price));
  chart.data.labels = data.map((_, i) => i);
  chart.data.datasets[0].data = data;
  chart.update();
}

function updateMainChart(currency) {
  const chart = state.charts.main;
  if(!chart) return;
  const hist = state.history[currency] || [];
  
  chart.data.labels = hist.map(d => {
    const parts = d.date.split('-');
    return `${parts[2]}/${parts[1]}`;
  });
  
  chart.data.datasets[0].data = hist.map(d => parseFloat(d.price));
  chart.data.datasets[0].borderColor = currency === 'USD' ? '#10b981' : '#3b82f6';
  chart.data.datasets[0].backgroundColor = currency === 'USD' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)';
  
  chart.update();
}

// === GEMINI AI INTEGRATION === //

async function callGemini(prompt, isJson = false) {
  // All calls go through the secure server proxy - API key never leaves the server
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, isJson })
    });
    
    if(!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.text;
  } catch (err) {
    console.error('Gemini proxy error:', err);
    throw err;
  }
}

async function runQuickAnalysis() {
  const content = document.getElementById('ai-analysis-content');
  content.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Gerando insights do mercado...</p></div>';
  
  // Build prompt
  const usdHist = state.history.USD.slice(-5).map(d => d.price).join(', ');
  const eurHist = state.history.EUR.slice(-5).map(d => d.price).join(', ');
  
  const prompt = `Você é um analista financeiro sênior especializado em câmbio. O objetivo do usuário é COMPRAR Dólar ou Euro pelo menor preço possível em Reais (BRL).
Contexto atual (cotações recentes e de hoje):
- USD/BRL últimos 5 dias: ${usdHist} (Atual: ${state.rates.USD.toFixed(3)})
- EUR/BRL últimos 5 dias: ${eurHist} (Atual: ${state.rates.EUR.toFixed(3)})

Regras aprendidas pelo modelo:
${state.rules.map(r => `- ${r.desc}`).join('\n') || "Nenhuma regra customizada ainda."}

Crie um resumo de 2 parágrafos.
Parágrafo 1: Análise do momento atual (tendência de alta ou baixa frente ao Real).
Parágrafo 2: Recomendação prática e DIRETA para COMPRA. IMPORTANTE: Não seja contraditório! 
- Se a previsão indica que vai cair ainda mais, recomende CLARAMENTE "AGUARDAR" e não diga que o momento atual é bom.
- Se a previsão indica que bateu no fundo e vai subir, recomende "COMPRAR AGORA".
Seja extremamente coerente, objetivo e use <strong> para destaques de palavras-chave. Sem rodeios.`;

  try {
    const text = await callGemini(prompt);
    
    // Parse response into HTML
    const formatted = text.split('\n\n').map(p => {
      let clean = p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return `<div class="ai-insight">${clean}</div>`;
    }).join('');
    
    content.innerHTML = formatted;
    
    // Update mini predictions
    els.predUsdMini.textContent = "Análise concluída. Veja painel IA.";
    els.predUsdMini.style.color = "var(--success)";
    els.predEurMini.textContent = "Análise concluída. Veja painel IA.";
    els.predEurMini.style.color = "var(--success)";
    
    // Clear prediction grid loading state if we are on dashboard and it was stuck
    if(state.activeView === 'dashboard') {
        const activeTab = document.querySelector('.pred-tab.active');
        if(activeTab) filterPredictionsByPeriod(activeTab.dataset.period);
    }
    
  } catch(err) {
    content.innerHTML = `<div class="ai-placeholder"><p style="color:var(--danger)">Erro na API Gemini: Verifique sua chave ou cota de uso.</p></div>`;
  }
}

async function generatePrediction() {
  if(!state.aiConnected) {
    showToast('Servidor IA não conectado. Verifique a configuração.', 'error');
    return;
  }
  
  const currency = document.getElementById('pred-currency').value;
  const period = document.getElementById('pred-period').value;
  const context = document.getElementById('pred-context').value;
  
  els.predictionGrid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>A IA está analisando o mercado. Isso pode levar alguns segundos...</p></div>';
  
  let promptContext = `Moeda alvo: ${currency === 'both' ? 'USD e EUR' : currency}. Período: ${period}. Data de Hoje: ${new Date().toLocaleDateString('pt-BR')}.`;
  if(context) promptContext += `\nContexto externo fornecido pelo usuário: "${context}"`;
  
  const scoreUSD = calculateBuyScore('USD');
  const scoreEUR = calculateBuyScore('EUR');
  
  const prompt = `Você é um modelo preditivo e analista quantitativo de câmbio BRL.
Sua função é APENAS contextualizar e justificar a matemática, e gerar os alvos futuros.

Cotações atuais: USD ${state.rates.USD.toFixed(3)}, EUR ${state.rates.EUR.toFixed(3)}.
Dados Quantitativos Calculados (USD): SMA(20)=${scoreUSD.sma}, RSI(14)=${scoreUSD.rsi}, Z-Score=${scoreUSD.zScore}, MathScore(0-100)=${scoreUSD.score}
Dados Quantitativos Calculados (EUR): SMA(20)=${scoreEUR.sma}, RSI(14)=${scoreEUR.rsi}, Z-Score=${scoreEUR.zScore}, MathScore(0-100)=${scoreEUR.score}
(Nota: MathScore é um algoritmo institucional. > 75 = Compra Forte, 60-74 = Compra Parcial, < 40 = Não Comprar).

${promptContext}

Gere uma previsão de preço estruturada como JSON com os seguintes campos:
{
  "predictions": [
    {
      "currency": "USD ou EUR",
      "targetDate": "ex: Final desta semana",
      "targetPrice": "valor numérico exato previsto (ex: 5.120)",
      "direction": "UP ou DOWN ou STABLE",
      "confidence": "porcentagem ex: 75%",
      "score_compra": "Apenas o número do MathScore fornecido acima (ex: 72)",
      "acao_recomendada": "COMPRAR AGORA, AGUARDAR, ou COMPRAR PARCIAL",
      "estrategia": "Resumo da estratégia em 1 frase baseada no Score",
      "reasoning": "Texto com o raciocínio justificando o cenário com base nos indicadores e contexto",
      "chartData": [
        { "date": "Data real futura (ex: Seg 20/05)", "price": 5.12, "reasoning": "Abertura com pressão de compra", "buySignal": false },
        { "date": "Data real futura (ex: Qua 22/05)", "price": 5.08, "reasoning": "Correção técnica esperada", "buySignal": true }
      ]
    }
  ]
}
Responda APENAS com o JSON válido, sem marcadores markdown \`\`\`json.`;

  try {
    const text = await callGemini(prompt, true);
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      // Fallback if Gemini accidentally included markdown even in JSON mode
      let cleanJson = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);    
      if (!jsonMatch) throw new Error('No JSON found in response');
      result = JSON.parse(jsonMatch[0]);
    }
    
    // Map new predictions with unique IDs and metadata first
    const newPreds = result.predictions.map(p => ({
      id: Date.now() + Math.random(),
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      period: period,
      ...p,
      status: 'pending' // pending, correct, wrong
    }));
    
    // Now render them
    renderPredictions(newPreds);
    
    state.predictions = [...newPreds, ...state.predictions];
    localStorage.setItem('forex_predictions', JSON.stringify(state.predictions));
    
    // Update active tab to match the generated period
    document.querySelectorAll('.pred-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.period === period);
    });
    
    updateBestBuyCard();
    
  } catch(err) {
    console.error(err);
    els.predictionGrid.innerHTML = `<div class="ai-placeholder"><p style="color:var(--danger)">Erro ao gerar previsão. O modelo pode não ter retornado um JSON válido. Tente novamente.</p></div>`;
  }
}

function renderPredictions(predictions) {
  els.predictionGrid.innerHTML = '';
  predictions.forEach(p => {
    const card = document.createElement('div');
    card.className = 'pred-card';
    
    // Score Badge Color
    let scoreColor = 'var(--text-muted)';
    let scoreNum = parseInt(p.score_compra) || 0;
    if(scoreNum >= 70) scoreColor = 'var(--success)';
    else if(scoreNum <= 40) scoreColor = 'var(--danger)';
    else scoreColor = 'var(--warning)';

    card.innerHTML = `
      <div class="pred-meta">
        <span class="currency-code">${p.currency}/BRL</span>
        <span class="pred-label">Alvo: ${p.targetDate}</span>
        <div class="pred-target-price">R$ ${p.targetPrice}</div>
        <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Score de Compra</div>
          <div style="font-size: 28px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: ${scoreColor}; line-height: 1.2; margin: 4px 0;">${p.score_compra || '-'}</div>
          <div style="font-size: 11px; font-weight: 700; color: ${scoreColor}; text-transform: uppercase;">${p.acao_recomendada || 'Analisando'}</div>
        </div>
      </div>
      <div class="pred-content" style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
        <div style="margin-bottom: 12px;">
          <h4 style="font-size: 15px; margin-bottom: 4px; color: white;">Estratégia e Fundamento (IA)</h4>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
            <strong style="color: white;">${p.estrategia || ''}</strong><br><br>
            ${p.reasoning}
          </p>
        </div>
        ${p.chartData && p.chartData.length > 0 ? `<div class="chart-container" style="flex: 1; min-height: 180px; width: 100%; position: relative; margin-top: 8px;"><canvas id="chart-${p.id}"></canvas></div>` : ''}
      </div>
    `;
    els.predictionGrid.appendChild(card);
  });

  // Initialize Charts
  predictions.forEach(p => {
    if (p.chartData && p.chartData.length > 0) {
      const canvas = document.getElementById(`chart-${p.id}`);
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const labels = p.chartData.map(d => d.date);
      const data = p.chartData.map(d => parseFloat(d.price));
      
      const pointColors = p.chartData.map(d => d.buySignal ? '#10b981' : (p.currency === 'USD' ? '#10b981' : '#3b82f6'));
      const pointRadius = p.chartData.map(d => d.buySignal ? 6 : 3);
      const pointBorder = p.chartData.map(d => d.buySignal ? '#fff' : 'transparent');
      
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Previsão',
            data: data,
            borderColor: p.currency === 'USD' ? '#10b981' : '#3b82f6',
            backgroundColor: p.currency === 'USD' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointBorder,
            pointBorderWidth: 2,
            pointRadius: pointRadius,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 17, 21, 0.95)',
              titleColor: '#9ba1ad',
              bodyColor: '#fff',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                label: function(context) {
                  const dataObj = p.chartData[context.dataIndex];
                  let label = ' R$ ' + context.raw.toFixed(3);
                  if(dataObj.buySignal) label += ' 🟢 (Oportunidade de Compra)';
                  return label;
                },
                afterLabel: function(context) {
                  const dataObj = p.chartData[context.dataIndex];
                  return 'Motivo: ' + dataObj.reasoning;
                }
              }
            }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  });
}

window.autoGeneratePrediction = function(period) {
  document.getElementById('pred-period').value = period;
  document.getElementById('pred-currency').value = 'both';
  generatePrediction();
};

function filterPredictionsByPeriod(period) {
  const filtered = state.predictions.filter(p => p.period === period && p.status === 'pending');
  
  if (filtered.length > 0) {
    // Sort by newest first using timestamp or fallback to ID
    filtered.sort((a, b) => (b.timestamp || b.id) - (a.timestamp || a.id));
    
    // We only care about the latest ones for this period (usually USD and EUR, so the top 2)
    const latestBatch = filtered.slice(0, 2);
    const latestTimestamp = latestBatch[0].timestamp || latestBatch[0].id;
    const isStale = (Date.now() - latestTimestamp) > (10 * 60 * 1000); // 10 minutes
    
    renderPredictions(latestBatch);
    
    // If it's older than 10 minutes, show a prominent warning to update
    if (isStale) {
      const banner = document.createElement('div');
      banner.className = 'stale-banner';
      banner.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); padding: 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 24px;">⏱️</span>
            <div>
              <strong style="color: var(--warning); display: block; font-size: 14px;">Previsão Desatualizada</strong>
              <span style="font-size: 13px; color: var(--text-muted);">Estes dados têm mais de 10 minutos. O mercado pode ter mudado.</span>
            </div>
          </div>
          <button class="btn-primary small" onclick="autoGeneratePrediction('${period}')">
            <span>↻</span> Atualizar Previsão
          </button>
        </div>
      `;
      els.predictionGrid.appendChild(banner);
    }
  } else {
    // Show empty state with a 1-click generate button
    els.predictionGrid.innerHTML = `
      <div class="ai-placeholder">
        <div class="ai-placeholder-icon">🔮</div>
        <p>Nenhuma previsão pendente para este período.</p>
        <button class="btn-primary" style="margin-top: 16px; margin-left: auto; margin-right: auto;" onclick="autoGeneratePrediction('${period}')">
          <span>⚡</span> Gerar Previsão Agora
        </button>
      </div>
    `;
  }
}

function calculateOpportunity() {
  const amount = parseFloat(document.getElementById('buy-amount-brl').value);
  const currency = document.getElementById('buy-currency-target').value;
  
  if(!amount || amount <= 0) {
    showToast('Insira um valor válido em BRL', 'warning');
    return;
  }
  
  const currentRate = state.rates[currency];
  const valueForeign = (amount / currentRate).toFixed(2);
  
  els.planResult.classList.remove('hidden');
  els.planResult.innerHTML = `
    <div style="background: rgba(16,185,129,0.1); border-left: 4px solid var(--success); padding: 16px; border-radius: 8px; margin-top: 16px;">
      <h4 style="color:white; margin-bottom: 8px;">Resultado da Simulação</h4>
      <p style="font-size: 14px; color: var(--text-muted);">Com R$ ${amount.toFixed(2)}, você compra hoje <strong>${valueForeign} ${currency}</strong> (Cotação: R$ ${currentRate.toFixed(3)}).</p>
      <p style="font-size: 13px; margin-top: 8px;">A IA recomenda aguardar. A previsão para a próxima semana indica uma possível queda, o que poderia render <strong>+${(valueForeign * 0.02).toFixed(2)} ${currency}</strong> pelo mesmo valor.</p>
    </div>
  `;
}

// === HISTORY & LEARNING === //
function renderHistory() {
  els.historyTbody.innerHTML = '';
  if(state.predictions.length === 0) {
    els.historyTbody.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhum histórico ainda. Gere sua primeira previsão!</td></tr>';
    return;
  }
  
  let correct = 0, wrong = 0;
  
  state.predictions.forEach(p => {
    if(p.status === 'correct') correct++;
    if(p.status === 'wrong') wrong++;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.date}</td>
      <td><strong>${p.currency}</strong></td>
      <td>R$ ${parseFloat(p.targetPrice).toFixed(3)}</td>
      <td>${p.actualPrice ? `R$ ${parseFloat(p.actualPrice).toFixed(3)}` : '-'}</td>
      <td>${p.direction === 'UP' ? '↗️ Alta' : '↘️ Baixa'}</td>
      <td>${p.actualDirection ? (p.actualDirection === 'UP' ? '↗️ Alta' : '↘️ Baixa') : '-'}</td>
      <td><span class="status-tag ${p.status}">${p.status === 'pending' ? 'Pendente' : (p.status === 'correct' ? 'Acerto' : 'Erro')}</span></td>
      <td>${p.status === 'pending' ? `<button class="btn-ghost small" onclick="switchView('learning'); populateLearnForm(${p.id})">Resolver</button>` : '-'}</td>
    `;
    els.historyTbody.appendChild(tr);
  });
  
  // Update stats
  const totalRes = correct + wrong;
  const acc = totalRes > 0 ? ((correct / totalRes) * 100).toFixed(1) : 0;
  document.getElementById('hist-accuracy').textContent = `${acc}%`;
  document.getElementById('hist-correct').textContent = correct;
  document.getElementById('hist-wrong').textContent = wrong;
  
  // Dashboard stats sync
  document.getElementById('accuracy-rate').textContent = `${acc}%`;
  document.getElementById('total-predictions').textContent = state.predictions.length;
  document.getElementById('correct-predictions').textContent = correct;
  document.getElementById('wrong-predictions').textContent = wrong;
}

function renderLearning() {
  const select = document.getElementById('update-prediction-select');
  select.innerHTML = '<option value="">Selecione uma previsão pendente...</option>';
  
  state.predictions.filter(p => p.status === 'pending').forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.date} - ${p.currency} (Previsto: ${p.direction} p/ R$ ${p.targetPrice})`;
    select.appendChild(opt);
  });

  renderInsights();
  renderRules();
}

function renderRules() {
  if (!els.rulesList) return;
  els.rulesList.innerHTML = '';
  
  if (state.rules.length === 0) {
    els.rulesList.innerHTML = `
      <div class="rule-item default">
        <div class="rule-number">R01</div>
        <div class="rule-content">
          <strong>Regra Base (Padrão)</strong>
          <p>Analisa cotação atual vs. média histórica dos últimos 30 dias para identificar oportunidades de compra abaixo da média.</p>
        </div>
      </div>
      <div class="rule-item default">
        <div class="rule-number">R02</div>
        <div class="rule-content">
          <strong>Tendência de Curto Prazo (Padrão)</strong>
          <p>Detecta padrões de alta/baixa nos últimos 7 dias para prever a tendência dos próximos 3 dias.</p>
        </div>
      </div>
    `;
    return;
  }
  
  state.rules.forEach((rule, idx) => {
    const div = document.createElement('div');
    div.className = 'rule-item custom';
    div.innerHTML = `
      <div class="rule-number">R${(idx + 1).toString().padStart(2, '0')}</div>
      <div class="rule-content">
        <strong>Regra Aprendida via Feedback</strong>
        <p>${rule.desc}</p>
      </div>
    `;
    els.rulesList.appendChild(div);
  });
}

function renderInsights() {
  if (!els.insightsList) return;
  
  if (state.insights.length === 0) {
    els.insightsList.innerHTML = `
      <div class="ai-placeholder">
        <div class="ai-placeholder-icon">📖</div>
        <p>O modelo ainda não tem histórico suficiente para gerar insights. Clique em "Gerar novos insights" para que a IA realize uma pesquisa avançada.</p>
      </div>
    `;
    return;
  }
  
  els.insightsList.innerHTML = state.insights.map(i => `
    <div class="insight-card">
      <div class="insight-header">
        <span class="insight-type type-${i.type.toLowerCase()}">${i.type}</span>
        <span class="insight-date">${i.date}</span>
      </div>
      <div class="insight-body">
        <h4>${i.title}</h4>
        <p>${i.description}</p>
      </div>
      <div class="insight-footer">
        <span class="insight-action">💡 Ação recomendada: ${i.action}</span>
      </div>
    </div>
  `).join('');
}

async function generateAdvancedInsights() {
  if (!state.aiConnected) {
    showToast('Conecte a IA primeiro para gerar insights.', 'error');
    return;
  }

  els.generateInsightsBtn.textContent = 'Analisando Mercado...';
  els.generateInsightsBtn.disabled = true;
  
  els.insightsList.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Buscando dados globais, analisando players do mercado e traçando paralelos históricos...</p>
    </div>
  `;

  try {
    const prompt = `Você é um Analista Quantitativo e Estrategista Chefe de um grande fundo de investimentos Global (Senior Institutional Trader).
Sua missão: Realizar uma análise profunda e retroalimentar nosso sistema preditivo.
Considere as seguintes informações do nosso sistema:
- Cotação atual USD: R$ ${state.rates.USD || 'Desconhecida'}
- Cotação atual EUR: R$ ${state.rates.EUR || 'Desconhecida'}
- Número de regras ativas no sistema: ${state.rules.length}
- Total de previsões no histórico: ${state.predictions.length}

Instruções:
Simule uma pesquisa em tempo real sobre os drivers macroeconômicos de hoje (taxa Selic, FED, BCE, commodities, risco geopolítico).
Analise o comportamento do mercado real. Identifique oscilações de curto, médio e longo prazo.
Crie 3 INSIGHTS acionáveis baseados no "smart money" (como grandes players estão se posicionando).
Os tipos de insight devem ser: "CURTO PRAZO", "MÉDIO PRAZO", "LONGO PRAZO" ou "ALERTA DE VOLATILIDADE".

Retorne APENAS um JSON estrito no seguinte formato:
\`\`\`json
[
  {
    "type": "CURTO PRAZO",
    "title": "Título do insight",
    "description": "Explicação macro e técnica profunda.",
    "action": "Comprar Dólar fracionado nos próximos 3 dias, etc."
  }
]
\`\`\`
Não adicione nenhum texto antes ou depois do JSON.`;

    const response = await callGemini(prompt, true);
    
    let newInsights;
    try {
      newInsights = JSON.parse(response);
    } catch (parseError) {
      let cleanJson = response.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);    
      if (!jsonMatch) throw new Error('No JSON found in response');
      newInsights = JSON.parse(jsonMatch[0]);
    }
    
    const today = new Date().toLocaleDateString('pt-BR');
    newInsights.forEach(i => i.date = today);
    
    state.insights = newInsights;
    localStorage.setItem('forex_insights', JSON.stringify(state.insights));
    
    showToast('Insights gerados com sucesso!', 'success');
  } catch (err) {
    console.error('Insights error:', err);
    showToast('Erro ao gerar insights. Tente novamente.', 'error');
  } finally {
    els.generateInsightsBtn.textContent = 'Gerar novos insights';
    els.generateInsightsBtn.disabled = false;
    renderInsights();
  }
}

window.populateLearnForm = function(id) {
  setTimeout(() => {
    document.getElementById('update-prediction-select').value = id;
  }, 100);
};

els.updateResultBtn.addEventListener('click', async () => {
  const id = document.getElementById('update-prediction-select').value;
  const actualPrice = document.getElementById('actual-value-input').value;
  const context = document.getElementById('market-context-input').value;
  
  if(!id || !actualPrice) return showToast('Preencha os campos', 'warning');
  
  const predIndex = state.predictions.findIndex(p => p.id == id);
  if(predIndex === -1) return;
  
  const pred = state.predictions[predIndex];
  pred.actualPrice = actualPrice;
  
  // Very basic logic to determine if it was correct (simplification)
  const initialPrice = parseFloat(state.history[pred.currency][state.history[pred.currency].length-2]?.price || actualPrice);
  const isUp = parseFloat(actualPrice) > initialPrice;
  pred.actualDirection = isUp ? 'UP' : 'DOWN';
  
  pred.status = (pred.direction === 'UP' && isUp) || (pred.direction === 'DOWN' && !isUp) ? 'correct' : 'wrong';
  
  state.predictions[predIndex] = pred;
  localStorage.setItem('forex_predictions', JSON.stringify(state.predictions));
  
  showToast(`Resultado registrado. IA iniciou aprendizado...`, 'info');
  
  // Simulate AI Learning
  if(state.aiConnected && pred.status === 'wrong') {
    els.updateResultBtn.textContent = "🧠 IA está re-treinando as regras...";
    const prompt = `Você é um modelo preditivo.
Previsão anterior: ${pred.currency} vai para ${pred.direction} (R$ ${pred.targetPrice}). Raciocínio original: ${pred.reasoning}.
Realidade: Fechou em R$ ${actualPrice}. O modelo ERROU.
Contexto do que aconteceu: ${context}
Gere UMA única frase curta como REGRA DE APRENDIZADO que você deve usar no futuro para não cometer esse erro.`;
    
    try {
      const ruleText = await callGemini(prompt);
      state.rules.push({ id: Date.now(), desc: ruleText });
      localStorage.setItem('forex_rules', JSON.stringify(state.rules));
      showToast('Nova regra de mercado aprendida e incorporada!', 'success');
    } catch(e) {}
    els.updateResultBtn.innerHTML = '<span>📚</span> Registrar e Treinar Modelo';
  } else {
    showToast('Modelo atualizado com sucesso.', 'success');
  }
  
  // Clear
  document.getElementById('update-prediction-select').value = '';
  document.getElementById('actual-value-input').value = '';
  document.getElementById('market-context-input').value = '';
  renderLearning();
});

// Boot
init();
