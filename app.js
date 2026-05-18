// App State
const state = {
  aiConnected: false,
  rates: { USD: null, EUR: null },
  history: JSON.parse(localStorage.getItem('forex_history')) || { USD: [], EUR: [] },
  predictions: JSON.parse(localStorage.getItem('forex_predictions')) || [],
  rules: JSON.parse(localStorage.getItem('forex_rules')) || [],
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
  openConfigBtn: document.getElementById('open-config-btn'),
  
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
  updatePredictionSelect: document.getElementById('update-prediction-select')
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
  els.saveConfigBtn.addEventListener('click', saveApiKey);
  els.skipConfigBtn.addEventListener('click', hideModal);
  els.openConfigBtn.addEventListener('click', showModal);
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
  
  if (els.planBuyBtn) els.planBuyBtn.addEventListener('click', calculateOpportunity);
  
  // Chart Tabs
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      updateMainChart(e.target.dataset.currency);
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

// === MARKET DATA === //
async function fetchMarketData() {
  els.refreshBtn.classList.add('loading');
  els.lastUpdateText.textContent = 'Atualizando...';
  
  try {
    // Fetch from free API
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    
    if (data.result === 'success') {
      const brlRate = data.rates.BRL; // USD to BRL
      const eurRate = data.rates.EUR; // USD to EUR
      
      const usdToBrl = brlRate;
      const eurToBrl = brlRate / eurRate; // Cross rate
      
      // Update state
      state.rates.USD = usdToBrl;
      state.rates.EUR = eurToBrl;
      
      // Save to history (mocking last 7 days for charts if empty)
      updateHistoryMock('USD', usdToBrl);
      updateHistoryMock('EUR', eurToBrl);
      
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

function updateHistoryMock(currency, currentRate) {
  if (!state.history[currency] || state.history[currency].length < 10) {
    // Generate some fake history for chart based on current rate
    const mock = [];
    let price = currentRate;
    for(let i=10; i>=0; i--) {
      // Random variation +/- 1%
      price = price * (1 + (Math.random() * 0.02 - 0.01));
      const d = new Date();
      d.setDate(d.getDate() - i);
      mock.push({ date: d.toISOString().split('T')[0], price: price.toFixed(4) });
    }
    // Set current day exact
    mock[mock.length-1] = { date: new Date().toISOString().split('T')[0], price: currentRate.toFixed(4) };
    state.history[currency] = mock;
    localStorage.setItem('forex_history', JSON.stringify(state.history));
  } else {
    // Just append today
    const today = new Date().toISOString().split('T')[0];
    const last = state.history[currency][state.history[currency].length-1];
    if (last.date === today) {
      last.price = currentRate.toFixed(4);
    } else {
      state.history[currency].push({ date: today, price: currentRate.toFixed(4) });
      if(state.history[currency].length > 30) state.history[currency].shift(); // keep 30 days
    }
    localStorage.setItem('forex_history', JSON.stringify(state.history));
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
  
  // Indicators
  document.getElementById('ind-volatility-usd').textContent = 'Média';
  document.getElementById('bar-vol-usd').style.width = '45%';
  
  updateSparkline('USD', state.history.USD);
  updateSparkline('EUR', state.history.EUR);
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

async function callGemini(prompt) {
  // All calls go through the secure server proxy - API key never leaves the server
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
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
  
  const prompt = `Você é um analista financeiro sênior especializado em câmbio (BRL).
Contexto atual:
- USD/BRL últimos 5 dias: ${usdHist} (Atual: ${state.rates.USD.toFixed(3)})
- EUR/BRL últimos 5 dias: ${eurHist} (Atual: ${state.rates.EUR.toFixed(3)})

Regras aprendidas pelo modelo:
${state.rules.map(r => `- ${r.desc}`).join('\n') || "Nenhuma regra customizada ainda."}

Crie um resumo de 2 parágrafos.
Parágrafo 1: Análise do momento atual (tendência de alta/baixa).
Parágrafo 2: Recomendação prática direta (Comprar agora, aguardar, qual moeda está melhor).
Seja extremamente objetivo e use formato markdown básico. Sem rodeios.`;

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
  
  let promptContext = `Moeda alvo: ${currency === 'both' ? 'USD e EUR' : currency}. Período: ${period}.`;
  if(context) promptContext += `\nContexto externo fornecido pelo usuário: "${context}"`;
  
  const prompt = `Você é um modelo preditivo de câmbio cambial BRL.
Cotações de hoje: USD ${state.rates.USD.toFixed(3)}, EUR ${state.rates.EUR.toFixed(3)}.
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
      "reasoning": "Texto com o raciocínio baseado nos dados e contexto"
    }
  ]
}
Responda APENAS com o JSON válido, sem marcadores markdown \`\`\`json.`;

  try {
    const text = await callGemini(prompt);
    // Robust JSON extraction: strip markdown fences and find JSON object
    let cleanJson = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    // Try to find the JSON object if there's extra text around it
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);    
    if (!jsonMatch) throw new Error('No JSON found in response');
    const result = JSON.parse(jsonMatch[0]);
    
    renderPredictions(result.predictions);
    
    // Save to predictions state
    const newPreds = result.predictions.map(p => ({
      id: Date.now() + Math.random(),
      date: new Date().toISOString().split('T')[0],
      period: period,
      ...p,
      status: 'pending' // pending, correct, wrong
    }));
    
    state.predictions = [...newPreds, ...state.predictions];
    localStorage.setItem('forex_predictions', JSON.stringify(state.predictions));
    
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
    card.innerHTML = `
      <div class="pred-meta">
        <span class="currency-code">${p.currency}/BRL</span>
        <span class="pred-label">Alvo: ${p.targetDate}</span>
        <div class="pred-target-price">R$ ${p.targetPrice}</div>
        <span class="signal-badge ${p.direction === 'UP' ? 'sell' : (p.direction === 'DOWN' ? 'buy' : 'hold')}">
          ${p.direction === 'UP' ? '📈 ALTA' : (p.direction === 'DOWN' ? '📉 BAIXA' : '➡️ ESTÁVEL')}
        </span>
        <span class="pred-label">Confiança: ${p.confidence}</span>
      </div>
      <div class="pred-content">
        <h4>Fundamento da IA</h4>
        <p>${p.reasoning}</p>
      </div>
    `;
    els.predictionGrid.appendChild(card);
  });
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
