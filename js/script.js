/* WalletBoard — controle de entradas e saídas com gráficos em SVG puro */

const CHAVE = 'walletboard_transacoes';
const $ = (s) => document.querySelector(s);
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chaveMes = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

const CATEGORIAS = {
  saida: [
    { id: 'moradia', nome: 'Moradia', cor: '#0a5c41' },
    { id: 'mercado', nome: 'Mercado', cor: '#0e9f6e' },
    { id: 'transporte', nome: 'Transporte', cor: '#3b82f6' },
    { id: 'lazer', nome: 'Lazer', cor: '#f59e0b' },
    { id: 'saude', nome: 'Saúde', cor: '#e5484d' },
    { id: 'contas', nome: 'Contas', cor: '#8b5cf6' },
    { id: 'outros', nome: 'Outros', cor: '#94a3b8' }
  ],
  entrada: [
    { id: 'salario', nome: 'Salário', cor: '#0e9f6e' },
    { id: 'freela', nome: 'Freelance', cor: '#14b8a6' },
    { id: 'vendas', nome: 'Vendas', cor: '#22c55e' },
    { id: 'outros-e', nome: 'Outras entradas', cor: '#84cc16' }
  ]
};
const todasCat = [...CATEGORIAS.saida, ...CATEGORIAS.entrada];
const cat = (id) => todasCat.find((c) => c.id === id) || CATEGORIAS.saida.at(-1);

const banco = {
  ler() { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch { return null; } },
  salvar(v) { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem storage */ } }
};

// Dados de exemplo nos últimos 6 meses, só na primeira visita
function gerarExemplo() {
  const lista = []; const hoje = new Date(); let id = 1;
  for (let m = 5; m >= 0; m--) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
    const dia = (d) => `${chaveMes(base)}-${pad(Math.min(d, m === 0 ? hoje.getDate() : 28))}`;
    const v = (x) => Math.round(x * (0.9 + ((m * 7 + x) % 20) / 100));
    lista.push(
      { id: id++, tipo: 'entrada', valor: 4200, desc: 'Salário', cat: 'salario', data: dia(5) },
      { id: id++, tipo: 'entrada', valor: v(650), desc: 'Site para cliente', cat: 'freela', data: dia(18) },
      { id: id++, tipo: 'saida', valor: 1350, desc: 'Aluguel', cat: 'moradia', data: dia(6) },
      { id: id++, tipo: 'saida', valor: v(820), desc: 'Mercado do mês', cat: 'mercado', data: dia(8) },
      { id: id++, tipo: 'saida', valor: v(260), desc: 'Combustível', cat: 'transporte', data: dia(12) },
      { id: id++, tipo: 'saida', valor: v(310), desc: 'Luz, água e internet', cat: 'contas', data: dia(10) },
      { id: id++, tipo: 'saida', valor: v(190), desc: 'Cinema e restaurante', cat: 'lazer', data: dia(20) },
      { id: id++, tipo: 'saida', valor: v(120), desc: 'Farmácia', cat: 'saude', data: dia(15) }
    );
  }
  return lista.filter((t) => t.data <= `${chaveMes(hoje)}-${pad(hoje.getDate())}`);
}

let transacoes = banco.ler() ?? gerarExemplo();
banco.salvar(transacoes);
let mesAtual = new Date(); mesAtual.setDate(1);
const filtro = { tipo: 'todas', busca: '' };

const doMes = (k) => transacoes.filter((t) => t.data.startsWith(k));
const soma = (lista, tipo) => lista.filter((t) => t.tipo === tipo).reduce((s, t) => s + t.valor, 0);

function render() {
  const k = chaveMes(mesAtual);
  const nomeMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  $('#mes-nome').textContent = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  // Cards
  const doMesAtual = doMes(k);
  const ent = soma(doMesAtual, 'entrada'), sai = soma(doMesAtual, 'saida');
  const ate = transacoes.filter((t) => t.data.slice(0, 7) <= k);
  const saldo = soma(ate, 'entrada') - soma(ate, 'saida');
  $('#saldo').textContent = brl(saldo);
  $('#entradas').textContent = brl(ent);
  $('#saidas').textContent = brl(sai);
  $('#economia').textContent = ent ? `${Math.round(((ent - sai) / ent) * 100)}%` : '—';
  $('#economia').className = ent - sai >= 0 ? 'pos' : 'neg';

  const ant = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1);
  const doAnt = doMes(chaveMes(ant));
  const variacao = (atual, antes, el, bomSubir) => {
    if (!antes) { el.textContent = 'sem dados do mês anterior'; el.className = ''; return; }
    const p = Math.round(((atual - antes) / antes) * 100);
    el.textContent = `${p > 0 ? '↑' : p < 0 ? '↓' : '='} ${Math.abs(p)}% vs. mês anterior`;
    el.className = p === 0 ? '' : (p > 0) === bomSubir ? 'sobe' : 'desce';
  };
  variacao(ent, soma(doAnt, 'entrada'), $('#var-entradas'), true);
  variacao(sai, soma(doAnt, 'saida'), $('#var-saidas'), false);

  renderRosca(doMesAtual, sai);
  renderBarras();
  renderTabela(doMesAtual);
}

function renderRosca(lista, total) {
  const porCat = {};
  lista.filter((t) => t.tipo === 'saida').forEach((t) => { porCat[t.cat] = (porCat[t.cat] || 0) + t.valor; });
  const itens = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const svg = $('#rosca');
  if (!itens.length) {
    svg.innerHTML = '<circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8e5" stroke-width="28"/><text x="100" y="105" text-anchor="middle" class="centro-rotulo">sem gastos</text>';
    $('#legenda').innerHTML = '<li class="sem-dados">Nenhuma saída registrada neste mês.</li>';
    return;
  }
  const R = 70, C = 2 * Math.PI * R; let acumulado = 0;
  svg.innerHTML = itens.map(([id, v]) => {
    const parte = (v / total) * C;
    const s = `<circle class="fatia" cx="100" cy="100" r="${R}" fill="none" stroke="${cat(id).cor}" stroke-width="28"
      stroke-dasharray="${Math.max(parte - 2, 0.5)} ${C}" stroke-dashoffset="${-acumulado}" transform="rotate(-90 100 100)"><title>${cat(id).nome}: ${brl(v)}</title></circle>`;
    acumulado += parte; return s;
  }).join('') + `<text x="100" y="98" text-anchor="middle" class="centro-valor">${Math.round(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</text><text x="100" y="118" text-anchor="middle" class="centro-rotulo">gasto no mês</text>`;
  $('#legenda').innerHTML = itens.map(([id, v]) =>
    `<li><i style="background:${cat(id).cor}"></i><span>${cat(id).nome}<small>${Math.round((v / total) * 100)}%</small></span><b>${brl(v)}</b></li>`).join('');
}

function renderBarras() {
  const meses = [];
  for (let i = 5; i >= 0; i--) meses.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth() - i, 1));
  const dados = meses.map((d) => { const l = doMes(chaveMes(d)); return { d, e: soma(l, 'entrada'), s: soma(l, 'saida') }; });
  const max = Math.max(1, ...dados.flatMap((x) => [x.e, x.s]));
  $('#barras').innerHTML = dados.map((x, i) => `
    <div class="mes-barra ${i === 5 ? 'atual' : ''}">
      <div class="par">
        <i class="e" style="height:${(x.e / max) * 100}%" title="Entradas: ${brl(x.e)}"></i>
        <i class="s" style="height:${(x.s / max) * 100}%" title="Saídas: ${brl(x.s)}"></i>
      </div>
      <span>${x.d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
    </div>`).join('');
}

function renderTabela(lista) {
  const termo = filtro.busca.trim().toLowerCase();
  const linhas = lista
    .filter((t) => (filtro.tipo === 'todas' || t.tipo === filtro.tipo) && (!termo || t.desc.toLowerCase().includes(termo) || cat(t.cat).nome.toLowerCase().includes(termo)))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
  $('#corpo').innerHTML = linhas.length ? linhas.map((t) => `
    <tr>
      <td>${t.data.slice(8)}/${t.data.slice(5, 7)}</td>
      <td>${escapar(t.desc)}</td>
      <td><span class="cat"><i style="background:${cat(t.cat).cor}"></i>${cat(t.cat).nome}</span></td>
      <td class="num ${t.tipo === 'entrada' ? 'pos' : 'neg'}">${t.tipo === 'entrada' ? '+' : '−'} ${brl(t.valor)}</td>
      <td><button class="excluir" data-id="${t.id}" aria-label="Excluir ${escapar(t.desc)}">×</button></td>
    </tr>`).join('') : '<tr class="vazio"><td colspan="5">Nenhuma transação encontrada neste mês.</td></tr>';
}

// Navegação de mês
$('#mes-ant').addEventListener('click', () => { mesAtual.setMonth(mesAtual.getMonth() - 1); render(); });
$('#mes-prox').addEventListener('click', () => { mesAtual.setMonth(mesAtual.getMonth() + 1); render(); });

// Filtros
$('#filtro-tipo').addEventListener('change', (e) => { filtro.tipo = e.target.value; render(); });
$('#busca').addEventListener('input', (e) => { filtro.busca = e.target.value; render(); });

// Excluir (dois toques)
$('#corpo').addEventListener('click', (e) => {
  const b = e.target.closest('.excluir'); if (!b) return;
  if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = '?'; b.title = 'Toque de novo para excluir'; setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = '×'; } }, 2500); return; }
  transacoes = transacoes.filter((t) => t.id !== Number(b.dataset.id));
  banco.salvar(transacoes); render();
});

// Modal de nova transação
function preencherCategorias() {
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
  $('#f-cat').innerHTML = CATEGORIAS[tipo].map((c) => `<option value="${c.id}">${c.nome}</option>`).join('');
}
$('#abrir-nova').addEventListener('click', () => {
  $('#form').reset(); preencherCategorias(); $('#erro').textContent = '';
  const hoje = new Date();
  const k = chaveMes(mesAtual);
  $('#f-data').value = k === chaveMes(hoje) ? `${k}-${pad(hoje.getDate())}` : `${k}-01`;
  $('#modal').showModal(); $('#f-valor').focus();
});
document.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', preencherCategorias));
$('#cancelar').addEventListener('click', () => $('#modal').close());
$('#f-valor').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^\d,.]/g, ''); });

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const valor = Number($('#f-valor').value.replace(/\./g, '').replace(',', '.'));
  const desc = $('#f-desc').value.trim(), data = $('#f-data').value;
  if (!valor || valor <= 0) return ($('#erro').textContent = 'Informe um valor maior que zero.');
  if (!desc) return ($('#erro').textContent = 'Escreva uma descrição.');
  if (!data) return ($('#erro').textContent = 'Escolha a data.');
  transacoes.push({ id: Date.now(), tipo: document.querySelector('input[name="tipo"]:checked').value, valor: Math.round(valor * 100) / 100, desc, cat: $('#f-cat').value, data });
  banco.salvar(transacoes);
  mesAtual = new Date(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, 1);
  $('#modal').close(); render();
});

render();
