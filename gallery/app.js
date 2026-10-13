'use strict';
const works = JSON.parse(document.getElementById('collection-data').textContent);
const chosen = new Map(works.map(w => [w.id, w.rounds.length - 1]));
const journalTabs = new Map(works.map(w => [w.id, 'critique']));
const names = {yandex: 'Yandex ART', sdxl: 'SDXL Base'};
const statuses = {pass:'Выполнено',fail:'Не выполнено',uncertain:'Неопределённо',initial:'Первый раунд',realized:'Реализовано',partially_realized:'Частично реализовано',not_realized:'Не реализовано',none:'Не назначалось'};
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function message(parent, title, value, className = '') {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
  const box = element('div', `log-message ${className}`);
  box.append(element('h5', '', title));
  if (Array.isArray(value)) {
    const list = element('ul');
    value.forEach(text => list.append(element('li', '', text)));
    box.append(list);
  } else box.append(element('p', '', String(value)));
  parent.append(box);
}
function disclosure(parent, title) {
  const details = element('details', 'log-disclosure');
  details.append(element('summary', '', title)); parent.append(details);
  const body = element('div', 'log-disclosure-body'); details.append(body);
  return body;
}
function branchCard(parent, branch, subtitle) {
  const card = element('section', `log-card log-${branch}`);
  const header = element('div', 'log-card-head');
  header.append(element('h4', '', names[branch]),element('span', '', subtitle));
  card.append(header); parent.append(card); return card;
}
function checks(parent, values, requirements) {
  const body = disclosure(parent, 'Проверка требований к теме');
  values.forEach(item => {
    const requirement = requirements.find(r => String(r.id) === String(item.requirement_id));
    const row = element('div', 'log-check');
    row.append(element('p', 'log-check-title', requirement?.description || `Требование ${item.requirement_id}`));
    row.append(element('span', 'log-check-status', statuses[item.status] || item.status));
    row.append(element('p', '', item.evidence)); body.append(row);
  });
}
function renderJournal(work, round) {
  const container = document.getElementById(work.id).querySelector('.conversation');
  container.replaceChildren();
  const header = element('div', 'log-heading');
  header.append(element('strong', '', `Раунд ${round.number} / ${work.rounds.length}`));
  header.append(element('span', '', `Критик: ${work.critic}`)); container.append(header);
  const tabs = element('div', 'log-tabs');
  tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label', `Диалог: ${work.title}`);
  container.append(tabs);
  const views = [['brief','Замысел'],['prompts','Промпты'],['critique','Разбор критика'],['exchange','Обмен приёмами']];
  const panels = new Map();
  views.forEach(([key, label]) => {
    const button = element('button','',label); button.type = 'button';
    button.id = `${work.id}-tab-${key}`; button.dataset.logTab = key;
    button.setAttribute('role','tab'); button.setAttribute('aria-controls',`${work.id}-panel-${key}`);
    tabs.append(button);
    const panel = element('div','log-panel'); panel.id = `${work.id}-panel-${key}`;
    panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',button.id);
    panel.tabIndex = 0;
    panels.set(key,panel); container.append(panel);
  });
  function selectTab(key, focus = false) {
    journalTabs.set(work.id,key);
    tabs.querySelectorAll('button').forEach(button => {
      const selected = button.dataset.logTab === key;
      button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1;
      panels.get(button.dataset.logTab).hidden = !selected;
      if (selected && focus) button.focus();
    });
  }
  tabs.addEventListener('click',event => {
    const button = event.target.closest('[data-log-tab]');
    if (button) selectTab(button.dataset.logTab);
  });
  tabs.addEventListener('keydown',event => {
    const keys = views.map(v => v[0]); const index = keys.indexOf(journalTabs.get(work.id));
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % keys.length;
    if (event.key === 'ArrowLeft') next = (index + keys.length - 1) % keys.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = keys.length - 1;
    if (next !== undefined) {event.preventDefault(); selectTab(keys[next],true);}
  });
  const brief = panels.get('brief');
  message(brief,'Исходная тема',work.theme);
  const director = element('section','log-card'); brief.append(director);
  director.append(element('h4','','Арт-директор · общий замысел'));
  message(director,'Сцена',work.brief.scene);
  message(director,'Композиция',work.brief.composition);
  message(director,'Стиль',work.brief.style);
  message(director,'Требования',work.brief.requirements.map(r => r.description));
  const prompts = element('div','log-columns'); panels.get('prompts').append(prompts);
  const critique = element('div','log-columns'); panels.get('critique').append(critique);
  for (const branch of work.branches) {
    const item = round.items[branch]; const review = item.review;
    const promptCard = branchCard(prompts,branch,'Промпт-инженер');
    message(promptCard,round.number === 1 ? 'Первый запрос' : 'Что меняем в этом раунде',item.plan.changes);
    message(promptCard,'Промпт художнику',item.plan.positive_prompt,'log-prompt');
    if (branch === 'sdxl' && item.plan.negative_prompt) {
      message(disclosure(promptCard,'Отрицательный промпт'),'Исключить',item.plan.negative_prompt,'log-prompt');
    }
    if (item.feedback.borrow_hint) message(promptCard,'Решение о переносе',item.plan.borrow_reason);
    const criticCard = branchCard(critique,branch,work.critic);
    message(criticCard,'Что критик предлагает сохранить',review.strengths);
    message(criticCard,'Замечания к изображению',review.problems.map(p => p.observation));
    if (round.number > 1) message(criticCard,'Что изменилось',review.change_evidence);
    if (round.number < work.rounds.length) message(criticCard,'Предложение к следующему раунду',review.next_change);
    checks(criticCard,review.checks,work.brief.requirements);
  }
  const exchange = panels.get('exchange');
  const assigned = work.branches.filter(branch => round.items[branch].feedback.borrow_hint);
  if (assigned.length) {
    exchange.append(element('h4','log-section-title','Переносы в этом раунде'));
    const columns = element('div','log-columns'); exchange.append(columns);
    assigned.forEach(branch => {
      const item = round.items[branch]; const hint = item.feedback.borrow_hint;
      const card = element('section','log-card'); columns.append(card);
      card.append(element('h4','log-direction',`${names[hint.source]} → ${names[hint.target]}`));
      card.append(element('p','log-caption',`Из раунда ${hint.source_round ?? round.number - 1} в раунд ${round.number}`));
      message(card,'Находка другого художника',hint.observation);
      message(card,'Как её адаптировать',hint.adaptation);
      message(card,item.plan.borrowed ? 'Инженер запланировал перенос' : 'Инженер отказался от переноса',item.plan.borrow_reason);
      if (item.plan.borrowed) message(card,`Наблюдение ${work.critic} после генерации`,item.review.borrow_evidence);
    });
  } else exchange.append(element('p','log-empty',round.number === 1 ? 'Первый раунд создаётся по теме. Предложения для обмена появляются после разбора этих изображений.' : 'Для этого раунда критик не предложил переносов между художниками.'));
  if (round.report.borrow_hints.length) {
    exchange.append(element('h4','log-section-title',`Предложения критика для раунда ${round.number + 1}`));
    const columns = element('div','log-columns'); exchange.append(columns);
    round.report.borrow_hints.forEach(hint => {
      const card = element('section','log-card'); columns.append(card);
      card.append(element('h4','log-direction',`${names[hint.source]} → ${names[hint.target]}`));
      message(card,'Что заметил критик',hint.observation);
      message(card,'Что передать художнику',hint.adaptation);
      message(disclosure(card,'Как критик предлагает проверить перенос'),'Ожидаемый признак',hint.success_check);
    });
  }
  selectTab(journalTabs.get(work.id));
}
function render(work, index) {
  const article = document.getElementById(work.id); const round = work.rounds[index];
  chosen.set(work.id, index);
  article.querySelectorAll('[data-round]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.round) === index));
  });
  for (const branch of work.branches) {
    const item = round.items[branch];
    const path = `assets/${work.run_id}/${item.image.path}`;
    const image = article.querySelector(`[data-image="${branch}"]`);
    image.src = path; image.alt = `${work.title} · ${names[branch]} · раунд ${round.number}`;
    article.querySelector(`[data-round-label="${branch}"]`).textContent = round.number;
    article.querySelector(`[data-original="${branch}"]`).href = path;
  }
  if (article.querySelector('.agent-log').open) renderJournal(work,round);
  else article.querySelector('.conversation').replaceChildren();
}
works.forEach(work => render(work, chosen.get(work.id)));
works.forEach(work => document.getElementById(work.id).querySelector('.agent-log').addEventListener('toggle',event => {
  if (event.target.open) renderJournal(work,work.rounds[chosen.get(work.id)]);
  else event.target.querySelector('.conversation').replaceChildren();
}));
document.querySelectorAll('[data-round]').forEach(button => button.addEventListener('click', () => {
  render(works.find(w => w.id === button.dataset.work), Number(button.dataset.round));
}));
const dialog = document.getElementById('lightbox');
document.querySelectorAll('[data-enlarge]').forEach(button => button.addEventListener('click', () => {
  const work = works.find(w => w.id === button.dataset.enlarge);
  const round = work.rounds[chosen.get(work.id)]; const branch = button.dataset.branch;
  const path = `assets/${work.run_id}/${round.items[branch].image.path}`;
  const title = `${work.title} · ${names[branch]} · раунд ${round.number}`;
  dialog.querySelector('img').src = path; dialog.querySelector('img').alt = title;
  document.getElementById('lightbox-title').textContent = title;
  document.getElementById('original').href = path; dialog.showModal();
}));
document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => dialog.querySelector('img').removeAttribute('src'));
