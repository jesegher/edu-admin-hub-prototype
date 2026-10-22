'use strict';

(() => {
  const storageKey = 'education-admin-hub-v2';
  const main = document.querySelector('main');
  const dialog = document.querySelector('dialog');
  const apps = [
    ['study', 'Study and Learn agent', "Makes the Study and Learn agent available to students in Copilot Chat. When off, students can't use it and it can't be pre-selected.", 'Students', 'Education', 'cp'],
    ['preselect', 'Pre-select Study and Learn agent in Copilot Chat', 'Students get coaching that helps them work through questions without receiving answers or completed work.', 'Students', 'Education', 'cp'],
    ['teach', 'Teach module', 'Lesson planning, differentiation, rubrics and assessment drafting, grounded in connected curriculum.', 'Educators', 'Copilot', 'cp'],
    ['insights', 'Class Insight Agent', "Educators ask questions about their own classes' progress, based on roster, assignment and LMS data.", 'Educators', 'Copilot', 'cp'],
    ['reading', 'Reading Coach', 'Personalized, AI-powered stories and independent reading fluency practice.', 'Students', 'Education', 'la'],
    ['progress', 'Reading Progress', 'Recorded reading fluency assignments in Teams.', 'Everyone', 'Teams', 'la'],
    ['search', 'Search Coach', 'Helps students form effective queries and judge source reliability.', 'Everyone', 'Teams', 'la'],
    ['speaker', 'Speaker Progress', 'Presentation practice with feedback on pace, filler words and more.', 'Everyone', 'Teams', 'la'],
    ['math', 'Math Progress', 'Practice problem sets with step-by-step feedback.', 'Everyone', 'Teams', 'la']
  ];
  const newAdminControls = new Set(['study', 'teach', 'insights', 'progress', 'search', 'speaker', 'math']);
  const catalogs = [
    ['schoology', 'SC', 'Schoology', 'MCP server', 'Teach, Study and Learn, Class Insight Agent'],
    ['moodle', 'MO', 'Moodle', 'MCP server', 'Teach, Study and Learn, Class Insight Agent'],
    ['brightspace', 'BS', 'D2L Brightspace', 'MCP server', 'Teach, Study and Learn, Class Insight Agent'],
    ['curriculum', 'SP', 'Curriculum grounding', 'SharePoint Online curriculum sites', 'Teach module'],
    ['standards', 'ST', 'State standards', 'Standards alignment for lessons', 'Teach'],
    ['custom', '+', 'Custom MCP server', 'Your own or a partner endpoint', 'Requires Entra app registration and admin review of each tool.']
  ];
  const sourceLabels = { groups: 'Microsoft Entra groups', grades: 'Grade level from School Data Sync', birth: 'Birth date in Microsoft Entra ID', csv: 'Manual (CSV upload)' };
  const institutionLabels = { k12: 'K-12', higher: 'Higher education', other: 'Other' };
  const groupOptions = ['Elementary students', 'Middle school students', 'High school students', 'Running Start students', 'Unclassified student cohort'];
  function validateCurriculum(config) {
    const seen = new Set();
    const errors = [];
    const urls = config.urls.map((value, index) => {
      let url;
      try { url = new URL(value.trim()); }
      catch (error) {
        if (!(error instanceof TypeError)) throw error;
        errors[index] = 'Enter a SharePoint Online site URL, for example https://contoso.sharepoint.com/sites/Curriculum.';
        return '';
      }
      const sharePointHost = /^[a-z0-9-]+\.(?:sharepoint\.com|sharepoint\.us|sharepoint-mil\.us|sharepoint\.cn|sharepoint\.de)$/i.test(url.hostname);
      if (url.protocol !== 'https:' || !sharePointHost || /-my\./i.test(url.hostname) || url.username || url.password || url.port) {
        errors[index] = 'Use an HTTPS SharePoint Online site URL without credentials or a custom port. OneDrive personal sites are not supported.';
        return '';
      }
      if (url.search || url.hash || /\/(?:[:_]|Forms\/)|\.(?:aspx|docx?|pdf|pptx?|xlsx?|csv|txt|zip)\/?$/i.test(url.pathname)) {
        errors[index] = 'Use the site URL, not a document, sharing link, or URL with query parameters or a fragment.';
        return '';
      }
      const normalized = url.href.replace(/\/+$/, '');
      const key = normalized.toLowerCase();
      if (seen.has(key)) errors[index] = 'This SharePoint site is already listed. Remove the duplicate.';
      else { seen.add(key); errors[index] = ''; }
      return normalized;
    });
    return { urls, errors, general: config.enabled && !urls.length ? 'Add at least one SharePoint site before enabling curriculum grounding.' : '' };
  }
  const defaults = () => ({
    version: 2, institution: 'k12', source: 'groups', classified: false, sdsHealthy: false,
    canvas: false, openstax: true, openstaxTeach: true, openstaxStudy: true, csvReady: false,
    groups: [['Elementary students'], ['Middle school students', 'High school students'], ['Running Start students']],
    grades: ['Minor', 'Not adult', 'Not adult', 'Adult'],
    apps: Object.fromEntries(apps.map(([id]) => [id, id !== 'math'])),
    connections: [], theme: 'light', curriculum: { enabled: false, urls: [] },
    ageAssessment: { unclassified: 3412, checkedAt: Date.now() },
    audit: [
      { text: 'Pre-selected Study and Learn agent in Copilot Chat for all students', time: 'Oct 9' },
      { text: 'Turned on Reading Coach for all students', time: 'Oct 2' },
      { text: 'Set institution type to K-12', time: 'Sep 18' }
    ]
  });
  let storageProblem = '';
  let state = defaults();
  let assessmentNeedsSaving = true;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const base = defaults();
      const valid = parsed && parsed.version === 2 &&
        Object.hasOwn(institutionLabels, parsed.institution) && Object.hasOwn(sourceLabels, parsed.source) &&
        ['classified', 'sdsHealthy', 'canvas', 'openstax', 'openstaxTeach', 'openstaxStudy'].every(key => typeof parsed[key] === 'boolean') &&
        apps.every(([id]) => typeof parsed.apps?.[id] === 'boolean') &&
        Array.isArray(parsed.groups) && parsed.groups.length === 3 && parsed.groups.every(group =>
          typeof group === 'string' ? groupOptions.includes(group) : Array.isArray(group) && group.every(name => groupOptions.includes(name))) &&
        Array.isArray(parsed.grades) && parsed.grades.length === 4 && parsed.grades.every(age => ['Minor', 'Not adult', 'Adult'].includes(age)) &&
        Array.isArray(parsed.connections) && parsed.connections.every(id => catalogs.some(item => item[0] === id)) &&
        Array.isArray(parsed.audit) && parsed.audit.every(item => typeof item.text === 'string' && typeof item.time === 'string') &&
        ['light', 'dark'].includes(parsed.theme) && (parsed.csvReady === undefined || typeof parsed.csvReady === 'boolean') &&
        (parsed.curriculum === undefined || (parsed.curriculum && typeof parsed.curriculum.enabled === 'boolean' &&
          Array.isArray(parsed.curriculum.urls) && parsed.curriculum.urls.every(url => typeof url === 'string') &&
          !validateCurriculum(parsed.curriculum).general && validateCurriculum(parsed.curriculum).errors.every(error => !error))) &&
        (parsed.ageAssessment === undefined || (parsed.ageAssessment &&
          [0, 3412].includes(parsed.ageAssessment.unclassified) &&
          Number.isSafeInteger(parsed.ageAssessment.checkedAt) && parsed.ageAssessment.checkedAt > 0 &&
          parsed.ageAssessment.checkedAt <= 8640000000000000));
      if (!valid || (!parsed.apps.study && parsed.apps.preselect)) throw new Error('Saved demo state has an unsupported shape.');
      state = { ...base, ...parsed };
      state.groups = parsed.groups.map(group => typeof group === 'string' ? [group] : [...new Set(group)]);
      if (parsed.ageAssessment === undefined) state.ageAssessment.unclassified = parsed.classified ? 0 : 3412;
      else assessmentNeedsSaving = false;
    }
  } catch (error) {
    console.error('Unable to restore Education Admin Hub demo state.', error);
    storageProblem = 'Saved demo settings could not be restored. Starting with sample defaults; use Reset demo to clear the saved data.';
  }
  let filter = 'all';
  let wizard = null;
  let successCount = null;
  let curriculumDraft = null;
  let curriculumErrors = [];
  let curriculumGeneralError = '';
  let toastTimer;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const badge = (label, kind = 'neutral') => {
    if (/^(?:[1-9]\d* )?action needed$/i.test(label)) kind = 'bad';
    else if (/^(?:needs review|[1-9]\d* to review)$/i.test(label)) kind = 'warn';
    return `<span class="badge ${kind}">${escape(label)}</span>`;
  };
  const button = (label, action, primary = false, extra = '') => `<button class="btn${primary ? ' primary' : ''}" data-action="${action}" ${extra}>${escape(label)}</button>`;
  const link = (label, target, primary = false) => `<a class="btn${primary ? ' primary' : ''}" href="#${target}">${escape(label)}</a>`;
  const feeds = names => `<div class="feeds">${names.split(', ').map(name => `<span class="feed">${escape(name)}</span>`).join('')}</div>`;
  const curriculumLink = label => `<a href="#curriculum" data-curriculum-link>${escape(label)}</a>`;
  const curriculumStatus = () => state.curriculum.enabled ? `${state.curriculum.urls.length} SharePoint ${state.curriculum.urls.length === 1 ? 'site' : 'sites'} configured for Teach module` : `Off${state.curriculum.urls.length ? ` · ${state.curriculum.urls.length} saved sites retained` : ' · No sites configured'}`;
  function curriculumSummary() {
    return `<div class="callout"><strong>Curriculum grounding</strong><p>${curriculumStatus()}. Study and Learn support is coming later.</p><p>${curriculumLink('Manage SharePoint curriculum sites')} in Connectors &amp; data. Settings saved there apply separately from guided setup; your setup draft stays in this tab.</p></div>`;
  }
  function curriculumChanged() {
    return curriculumDraft && JSON.stringify(curriculumDraft) !== JSON.stringify(state.curriculum);
  }
  function updateCurriculumDraftControls() {
    const dirty = curriculumChanged();
    main.querySelectorAll('[data-action="curriculum-save"], [data-action="curriculum-cancel"]').forEach(control => { control.disabled = !dirty; });
    const status = main.querySelector('#curriculum-draft-status');
    if (status) status.textContent = dirty ? 'Unsaved changes' : 'No unsaved changes';
  }
  function curriculumSection() {
    if (!curriculumDraft) curriculumDraft = { enabled: state.curriculum.enabled, urls: [...state.curriculum.urls] };
    return `<section class="card padded" id="curriculum-grounding" tabindex="-1" aria-labelledby="curriculum-title">
      <div class="section-head"><div><span class="eyebrow">SharePoint Online · Curriculum</span><h2 id="curriculum-title">Curriculum grounding</h2></div>${badge(state.curriculum.enabled ? 'Enabled · Saved configuration' : 'Off · Saved configuration', state.curriculum.enabled ? 'good' : 'neutral')}</div>
      <p class="small">Choose the SharePoint sites that store your curriculum for Teach module. Study and Learn support will come later.</p>
      <div class="curriculum-audiences"><span class="feed">Teach module</span>${badge('Study and Learn · Coming later', 'neutral')}</div>
      <div class="setting"><div class="copy"><label for="curriculum-enabled">Enable curriculum grounding</label><p>Allow Teach module to use curriculum from the sites below in the concept. Disabling keeps the saved URLs so you can re-enable without re-entering them.</p></div><input type="checkbox" role="switch" class="switch" id="curriculum-enabled" data-curriculum-enabled ${curriculumDraft.enabled ? 'checked' : ''}></div>
      ${!state.apps.teach ? `<div class="callout"><strong>Teach module is turned off</strong><p>You can save this configuration now. ${link('Review Teach module', 'apps')} to enable the module before using grounding.</p></div>` : ''}
      ${state.connections.includes('curriculum') ? '<div class="callout">The earlier generic curriculum connector did not specify sites. Add and save SharePoint site URLs here to replace that sample configuration.</div>' : ''}
      <h3 class="method-heading">SharePoint site URLs</h3><p class="small" id="curriculum-url-help">Use site URLs such as https://contoso.sharepoint.com/sites/Curriculum, not file or sharing links. Add one site per row.</p>
      <div id="curriculum-general-error" class="error" role="alert" ${curriculumGeneralError ? '' : 'hidden'}>${escape(curriculumGeneralError)}</div>
      <div class="curriculum-sites">${curriculumDraft.urls.length ? curriculumDraft.urls.map((url, index) => `<div class="curriculum-site"><label for="curriculum-url-${index}">SharePoint site ${index + 1}</label><div class="curriculum-url-row"><input type="url" id="curriculum-url-${index}" data-curriculum-url="${index}" value="${escape(url)}" placeholder="https://contoso.sharepoint.com/sites/Curriculum" autocomplete="off" spellcheck="false" aria-invalid="${!!curriculumErrors[index]}" aria-describedby="curriculum-url-help curriculum-error-${index}">${button('Remove', 'curriculum-remove', false, `data-index="${index}" aria-label="Remove SharePoint site ${index + 1}"`)}</div><p class="error" id="curriculum-error-${index}" role="alert" ${curriculumErrors[index] ? '' : 'hidden'}>${escape(curriculumErrors[index] || '')}</p></div>`).join('') : '<p class="empty">No sites added. Add a SharePoint site to get started.</p>'}</div>
      <div class="actions">${button('Add SharePoint site', 'curriculum-add')}</div>
      <div class="callout"><strong>Demo configuration only</strong><p>Use fictional URLs. Format checks do not verify site existence, tenant ownership, permissions, or access. No SharePoint content is fetched or indexed and no access is granted. Saved URLs stay in this browser.</p></div>
      <div class="curriculum-save-bar"><div class="actions">${button('Save curriculum settings', 'curriculum-save', true, curriculumChanged() ? '' : 'disabled')}${button('Cancel', 'curriculum-cancel', false, curriculumChanged() ? '' : 'disabled')}</div><span id="curriculum-draft-status" class="small muted" role="status">${curriculumChanged() ? 'Unsaved changes' : 'No unsaved changes'}</span></div>
      <p class="small muted">The switch and URL edits take effect only after Save. Unsaved edits stay in this tab until saved or canceled.</p>
    </section>`;
  }
  const adminAreas = [
    ['Home', 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10', false],
    ['Users', 'M20 21v-2a8 8 0 0 0-16 0v2M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10', true],
    ['Copilot', 'M8 4h9l4 8-4 8H8L4 12 8 4ZM9 4 5 20M16 4l-4 16', true],
    ['Agents', 'M8 4h8l5 8-5 8H8l-5-8 5-8ZM15 4 9 20', true],
    ['Apps', 'M3 3h8v8H3ZM3 13h8v8H3ZM13 13h8v8h-8ZM17 2l5 5-5 5-5-5Z', true],
    ['Education', 'M2 9 12 4l10 5-10 5L2 9ZM6 11v7c4 3 8 3 12 0v-7M22 9v8', true],
    ['Teams & groups', 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM17 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM2 21v-3a6 6 0 0 1 12 0v3M15 13a5 5 0 0 1 7 5v3', true],
    ['Roles', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM2 21v-3a7 7 0 0 1 11-5M14 14h8v8h-8ZM16 14v-3h4v3M16 18h4', true],
    ['Resources', 'M4 10V3h14v7M4 18H2v-8h20v8h-2M6 14h12v8H6ZM17 7h1', true],
    ['Marketplace', 'M3 8h18v14H3ZM7 8V6a5 5 0 0 1 10 0v2', false],
    ['Billing', 'M2 4h20v16H2ZM2 9h20M6 15h4', true],
    ['Support', 'M4 15v-4a8 8 0 0 1 16 0v4M4 12H2v7h4v-7ZM20 12h2v7h-4v-7ZM20 19v3h-8', true],
    ['Settings', 'M9 3h6l1 4 4-1 3 5-3 3 1 4-5 3-3-3-4 1-3-5 3-3ZM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8', true],
    ['Setup', 'M14 4a6 6 0 0 0-7 8L2 18a3 3 0 0 0 4 4l6-6a6 6 0 0 0 8-7l-4 4-5-5 3-4Z', true],
    ['Reports', 'M3 3v18h19M6 16l5-6 4 3 6-8', true],
    ['Health', 'M12 21 3 12a6 6 0 0 1 9-8 6 6 0 0 1 9 8l-9 9ZM2 11h5l3-4 4 8 3-4h5', true]
  ];
  const navigationIcon = path => `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  document.querySelector('#admin-menu').innerHTML = adminAreas.map(([label, path, expandable]) => {
    const icon = navigationIcon(path);
    if (label === 'Education') return `<details id="education-menu" class="admin-group education-group" open><summary>${icon}<span>Education</span></summary><div class="admin-children">${[['overview', 'Overview'], ['setup', 'Guided setup'], ['safety', 'Student safety'], ['apps', 'Apps & agents'], ['connectors', 'Connectors & data']].map(([id, title]) => `<a href="#${id}" data-nav="${id}">${escape(title)}</a>`).join('')}</div></details>`;
    const context = `<button class="admin-context" data-action="admin-context" data-admin-area="${escape(label)}">${expandable ? `Open ${escape(label)}` : `${icon}<span>${escape(label)}</span>`}</button>`;
    return expandable ? `<details class="admin-group"><summary>${icon}<span>${escape(label)}</span></summary><div class="admin-children">${context}</div></details>` : context;
  }).join('');
  function setNavigationExpanded(expanded) {
    document.querySelector('.shell').classList.toggle('nav-collapsed', !expanded);
    const toggle = document.querySelector('#nav-toggle');
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation');
  }
  const heading = (title, description, action = '') => `<div class="crumb">Microsoft 365 admin center &rsaquo; Education${title === 'Education' ? '' : ` &rsaquo; ${escape(title)}`}</div><div class="page-head"><div><h1>${escape(title)}</h1><p class="lede">${escape(description)}</p></div>${action}</div>`;
  const freshnessNote = () => `<aside class="callout exploration"><strong>Proposed behavior: automatic count updates</strong><p>This demo updates age-group counts automatically after saved classification changes. Automatic refresh in the product, including after roster changes, is subject to engineering validation; timing and feasibility are not confirmed. Setup drafts do not affect counts until applied.</p></aside>`;
  const integrationNote = () => `<aside class="callout exploration"><span class="badge info">Integration under exploration</span><h3>Microsoft 365 guided setup</h3><p>We’re exploring integration with the Microsoft 365 admin center’s guided setup. This concept shows a standalone experience, which remains the fallback if integration isn’t available.</p></aside>`;
  const ageCounts = (classified = state.classified) => classified ? [10804, 8014, 122, 0] : [9104, 6302, 122, 3412];
  const assessedAgeCounts = () => ageCounts(state.ageAssessment.unclassified === 0);
  function assessmentStatus() {
    const date = new Date(state.ageAssessment.checkedAt);
    return `<div class="count-assessment"><p class="small muted">Last updated <time datetime="${date.toISOString()}">${escape(date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time> · Updates automatically after saved classification changes in this demo.</p></div>`;
  }
  function assessmentSummary() {
    return `<div class="callout"><strong>${state.ageAssessment.unclassified.toLocaleString()} unclassified students</strong>${assessmentStatus()}</div>`;
  }
  function updateAgeAssessment() {
    const unclassified = ageCounts()[3];
    if (state.ageAssessment.unclassified !== unclassified) {
      state.ageAssessment = { unclassified, checkedAt: Date.now() };
    }
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
  }
  function persist() {
    updateAgeAssessment();
    try { localStorage.setItem(storageKey, JSON.stringify(state)); storageProblem = ''; }
    catch (error) {
      console.error('Unable to save Education Admin Hub demo state.', error);
      storageProblem = 'Browser storage is unavailable. Changes work in this tab but will not survive a reload.';
    }
  }
  function record(text) {
    state.audit.unshift({ text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    state.audit = state.audit.slice(0, 60);
  }
  function finish(message) {
    persist();
    render(false);
    notify(storageProblem || message);
  }
  function readiness() {
    return [
      [state.ageAssessment.unclassified === 0, 'Student age groups', state.ageAssessment.unclassified === 0 ? 'All 18,940 sample students have an age group in Microsoft Entra ID' : '3,412 of 18,940 students (18%) are unclassified in Microsoft Entra ID', 'safety', 'Classify students', 'Action needed'],
      [state.canvas, 'Learning data connections', state.canvas ? 'Canvas data is available to the selected agents in this demo' : "Canvas data for 214 classes isn't connected to Teach or Study and Learn", 'connectors', 'Connect Canvas', 'Recommended'],
      [true, 'Institution type', `${institutionLabels[state.institution]} · set by your admin`, 'safety', 'View', ''],
      [state.apps.study && state.apps.preselect && state.apps.reading, 'AI experiences', `Study and Learn ${state.apps.study ? 'available' : 'off'} · Pre-selection ${state.apps.preselect ? 'on' : 'off'} · Reading Coach ${state.apps.reading ? 'on' : 'off'}`, 'apps', 'View', 'Needs review']
    ].sort((a, b) => {
      const rank = row => row[0] ? 3 : { 'Action needed': 0, 'Needs review': 1, Recommended: 2 }[row[5]];
      return rank(a) - rank(b);
    });
  }
  function overview() {
    const rows = readiness();
    const ready = rows.filter(row => row[0]).length;
    return heading('Education', 'Every setting that shapes teaching, learning and student safety for Contoso Unified School District, in one place. Changes made here sync with Teams, Entra and Purview in the concept; this demo changes sample data only.') +
      `<section class="card padded" aria-labelledby="quick-overview-title"><h2 id="quick-overview-title">Quick overview</h2><div class="tenant">${badge(institutionLabels[state.institution], 'info')}<span>18,940 students</span><span>1,612 educators</span><span>41 schools</span></div></section>
      ${state.ageAssessment.unclassified ? `<div class="banner"><span class="banner-icon" aria-hidden="true">&#9888;</span><div><strong>3,412 students don't have an age group yet</strong><p>Microsoft AI experiences use age group to decide what each student can access.</p>${assessmentStatus()}</div><div class="actions">${link('Start guided setup', 'setup', true)}${link('Review students', 'safety')}</div></div>` : `<div class="callout" style="margin-bottom:24px"><strong>All sample students have an age group</strong><p>0 unclassified students. Explore Apps &amp; agents or finish connecting learning data.</p>${assessmentStatus()}</div>`}
      <section class="card padded"><div class="section-head"><h2>Tenant readiness</h2>${link('Fix with guided setup', 'setup')}</div><p class="small">Checks age groups, institution type, AI experiences and data connections</p>
      <div class="readiness"><div class="ring" style="--progress:${ready / rows.length * 100}"><span>${ready}/${rows.length}</span></div><div><h3>${ready} of ${rows.length} areas ready for students</h3><p>Student age-group readiness updates automatically after saved classification changes in this demo.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Status</th><th>Area</th><th>What we found</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${rows.map(([ok, area, description, target, action, status]) => `<tr><td>${badge(ok ? 'Ready' : status, ok ? 'good' : status === 'Action needed' ? 'bad' : status === 'Recommended' ? 'info' : 'warn')}</td><td><strong>${area}</strong></td><td><p>${escape(description)}</p></td><td><a href="#${target}">${ok ? 'View' : action}</a></td></tr>`).join('')}</tbody></table></div></section>
      <div class="tiles">${[
        ['safety', '&#9826;', 'Student safety', 'Institution type and student age groups'],
        ['apps', '&#8862;', 'Apps & agents', 'Copilot agents and Learning Accelerators'],
        ['connectors', '&#8644;', 'Connectors & data', 'Learning data for your agents and a handoff to School Data Sync']
      ].map(([id, icon, title, description]) => `<a href="#${id}" class="card tile"><span class="tile-icon" aria-hidden="true">${icon}</span><h3>${escape(title)}</h3><p>${description}</p></a>`).join('')}</div>
      <section class="card padded"><div class="section-head"><h2>Audit &amp; accountability</h2><button class="text-button" data-action="audit">View audit log</button></div><p class="small">Use the existing audit experience rather than a separate Recent changes feed. Event coverage and an Education-filtered destination still need validation. The link previews the handoff; no live audit service is connected.</p></section>${freshnessNote()}`;
  }
  function institutions(value, name) {
    return [['k12', 'K-12 (primary and secondary schools)'], ['higher', 'Higher education (colleges and universities)'], ['other', 'Other (research institution, academic library, etc.)']].map(([id, label]) =>
      `<label class="option"><input type="radio" name="${name}" value="${id}" ${value === id ? 'checked' : ''}><span>${escape(label)}</span></label>`).join('');
  }
  function sourceOptions(value, name) {
    const hints = {
      groups: 'Assign the groups you already manage, such as school or grade-band groups, to each age group.',
      grades: 'Explore grade mappings. Provisioning approach and update cadence require validation.',
      birth: 'Explore using birth dates in Entra ID. Attribute availability and provisioning require validation.',
      csv: 'Review a sample CSV and simulate importing manually assigned age groups. No real files or student data are uploaded.'
    };
    return `<p class="small">Use more than one method or transition between methods. Open a method to configure it; this does not disable other methods. Applying classification writes age-group values in the concept, not just a chart display.</p><div class="method-grid">${Object.entries(sourceLabels).map(([id, label]) => `<button class="method-card" data-method="${id}" data-method-context="${name}" aria-pressed="${value === id}"><strong>${label}</strong>${id === 'groups' ? badge('Recommended', 'info') : ['grades', 'birth'].includes(id) ? badge('Under exploration', 'info') : badge('One-time import')}<span>${hints[id]}</span><span class="method-open">${value === id ? 'Currently open' : 'Open method'} &rarr;</span></button>`).join('')}</div><div class="callout"><strong>Policy behavior to validate</strong><p>Cross-method precedence, overwriting existing values, and migration behavior are unresolved. Group policy is an ongoing-policy concept; CSV is a one-time assignment. Grade and birth-date provisioning need separate validation and costing.</p></div>`;
  }
  function mappings(source, model, prefix) {
    if (source === 'groups') return `<h3 class="method-heading">Assign groups to each age group</h3><div class="mapping">${['Minor', 'Not adult', 'Adult'].map((age, index) => `<div class="mapping-row group-row"><strong>${age}</strong><details class="group-picker"><summary>${model.groups[index].length ? model.groups[index].map(escape).join(', ') : 'Select groups'}</summary><label class="field">Search ${age.toLowerCase()} groups<input type="search" placeholder="Search Microsoft Entra groups" data-group-search aria-label="Search ${age} groups"></label><div class="group-results">${groupOptions.map((group, option) => `<label class="option" data-group-option="${escape(group.toLowerCase())}"><input type="checkbox" id="${prefix}group-${index}-${option}" data-group-context="${prefix}" data-group-index="${index}" value="${escape(group)}" ${model.groups[index].includes(group) ? 'checked' : ''}><span>${escape(group)} ${badge(group === 'Unclassified student cohort' ? 'Dynamic' : 'Static')}</span></label>`).join('')}<p class="small" data-no-groups hidden>No matching sample groups.</p></div></details></div>`).join('')}</div><p class="small">Students in multiple assigned groups receive the more protective age group. Static and dynamic group support, licensing, and evaluation cadence require validation. Group types shown here are sample data.</p><div class="callout"><strong>Implementation under exploration</strong><p>Evaluate dynamic groups based on grade or birth-date attributes feeding this group-based policy, rather than separate provisioning engines. Supported attributes, licensing, and cost savings are not confirmed.</p></div>`;
    if (source === 'grades') return `<h3>Grade mapping</h3><div class="mapping">${['Pre-K - Grade 6', 'Grades 7 - 8', 'Grades 9 - 12', 'Adult education'].map((band, index) => `<label class="mapping-row"><strong>${band}</strong><select id="${prefix}grade-${index}" aria-label="${band}" data-map="${prefix}grades" data-index="${index}">${['Minor', 'Not adult', 'Adult'].map(age => `<option ${model.grades[index] === age ? 'selected' : ''}>${age}</option>`).join('')}</select></label>`).join('')}</div><p class="small">Defaults follow your region's digital consent age. This demo uses illustrative mappings, not eligibility policy.</p>`;
    if (source === 'csv') return `<div class="callout"><strong>Manual classification</strong><p class="small">The demo simulates validating and importing a sample file. No actual upload is performed.</p><div class="actions" style="margin-top:12px">${badge(state.csvReady ? 'Sample CSV validated' : 'No sample CSV loaded', state.csvReady ? 'good' : 'warn')}${button('Review sample CSV', 'csv-preview')}</div></div>`;
    return '<div class="callout"><strong>Birth date in Microsoft Entra ID · Under exploration</strong><p>Validate the supported attribute, how it is populated, and whether it can support provisioning. One-time versus ongoing assignment is not settled. No real dates of birth are collected; the preview uses fixed illustrative counts.</p></div>';
  }
  function safety() {
    const counts = assessedAgeCounts();
    return heading('Student safety', 'Tell us what kind of institution you are and classify your students by age group, so Microsoft AI experiences are appropriate for every student.') +
      `<section class="card padded"><div class="section-head"><h2>Institution type</h2>${badge('Saved in demo', 'neutral')}</div><p class="small">Your institution type sets the defaults for every education experience, including which AI features are on by default.</p><div role="radiogroup" aria-label="Institution type">${institutions(state.institution, 'institution')}</div></section>
      <section class="card padded"><div class="section-head"><h2>Student age groups</h2>${badge(counts[3] === 0 ? 'All classified' : '3,412 unclassified', counts[3] === 0 ? 'good' : 'bad')}</div><p class="small">Students are classified by their Microsoft Entra ID age group so AI experiences are appropriate for their age. Counts reflect saved sample classifications.</p>
      <div class="stats">${['Minor', 'Not adult', 'Adult', 'Unclassified'].map((age, index) => `<div class="stat${index === 3 && counts[3] > 0 ? ' alert' : ''}"><span>${age}</span><strong>${counts[index].toLocaleString()}</strong></div>`).join('')}</div>
      <div class="breakdown" role="img" aria-label="${counts.map((count, index) => `${count} ${['minor', 'not adult', 'adult', 'unclassified'][index]}`).join(', ')}">${counts.map(count => `<span style="flex:${count};${count === 0 ? 'display:none' : ''}"></span>`).join('')}</div>
      ${assessmentStatus()}
      ${freshnessNote()}
      <h3 style="margin-top:24px">Classification methods</h3>${sourceOptions(state.source, 'source')}
      ${mappings(state.source, state, '')}
      <div class="callout">Students without an age group are handled by the Copilot eligibility check. Classifying them gives them the experiences intended for their age group.</div>
      <div class="actions" style="margin-top:20px">${button(state.classified ? 'Preview classification' : 'Preview 3,412 classifications', 'classify', true, state.source === 'csv' && !state.csvReady ? 'disabled' : '')}<span class="small muted">${state.source === 'csv' && !state.csvReady ? 'Load the sample CSV before classifying students.' : state.classified ? 'Sample classification applied. Counts are up to date.' : 'Preview and confirm before applying sample changes. Counts update automatically.'}</span></div></section>`;
  }
  function appSetting(app, model = state.apps, wizardMode = false) {
    const [id, title, description, audience, source] = app;
    const disabled = id === 'preselect' && !model.study;
    const controlId = `${wizardMode ? 'w-' : ''}app-${id}`;
    const isNew = newAdminControls.has(id);
    return `<div class="setting"><div class="copy"><div class="setting-title"><label for="${controlId}">${title}</label>${isNew ? `<span class="badge new-control" id="${controlId}-new">New<span class="sr-only"> admin control in this concept</span></span>` : ''}</div><p>${description}${disabled ? ' Turn on Study and Learn to enable pre-selection.' : ''}</p>${id === 'teach' ? `<p>Curriculum grounding: ${curriculumStatus()}. ${curriculumLink('Manage curriculum sites')}</p>` : ''}</div><span class="small muted">${audience}</span><span class="source">${source}</span><input type="checkbox" role="switch" class="switch" id="${controlId}" data-app="${id}" ${isNew ? `aria-describedby="${controlId}-new"` : ''} ${wizardMode ? 'data-wizard' : ''} ${model[id] ? 'checked' : ''} ${disabled ? 'disabled' : ''}></div>`;
  }
  function appScreen() {
    return heading('Apps & agents', 'Copilot agents and Learning Accelerators, gathered from Copilot settings and Microsoft Education settings.') +
      `<p class="small" style="margin-bottom:18px"><strong>New</strong> marks new admin controls in this concept, not newly released apps or shipping availability.</p><div class="filters" role="group" aria-label="Filter settings">${[['all', 'All settings'], ['cp', 'Copilot & agents'], ['la', 'Learning Accelerators']].map(([id, label]) => `<button class="btn" data-filter="${id}" aria-pressed="${filter === id}">${escape(label)}</button>`).join('')}</div>
      ${[['cp', 'Copilot & agents'], ['la', 'Learning Accelerators']].filter(([id]) => filter === 'all' || filter === id).map(([id, title]) => `<section class="card padded"><div class="section-head"><h2>${escape(title)}</h2>${badge('Saved automatically', 'neutral')}</div>${apps.filter(app => app[5] === id).map(app => appSetting(app)).join('')}</section>`).join('')}
      <div class="callout">Prototype controls only. Turning off Study and Learn also clears pre-selection. No tenant settings are changed. <a href="#safety">Review student age groups in Student safety.</a></div>`;
  }
  function toggle(id, label, checked, disabled = false) {
    return `<label class="option"><input type="checkbox" id="toggle-${id}" data-toggle="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${label}</span></label>`;
  }
  function connectors() {
    return heading('Connectors & data', 'Keep rosters in sync and connect the data your agents use. Each does a different job.') +
      `<div class="tiles flow">${[
        ['Agent data', 'Agent connectors', 'LMS & content → Copilot agents', 'Courses, assignments, rubrics and curriculum for Teach, Study and Learn and Class Insight Agent.'],
        ['Roster & identity', 'School Data Sync', 'Your SIS → Entra ID & Teams', 'Users, groups, classes and enrollments. Managed in the School Data Sync portal.']
      ].map(([category, title, direction, description]) => `<div class="tile"><span class="eyebrow">${category}</span><h3>${title}</h3><strong class="small">${direction}</strong><p>${description}</p></div>`).join('')}</div>
      ${curriculumSection()}
      <section class="card padded"><div class="section-head"><h2>Agent connectors</h2>${badge(`${Number(state.openstax) + Number(state.canvas) + Number(state.curriculum.enabled) + state.connections.filter(id => id !== 'curriculum').length} enabled configurations`, 'info')}</div>
      <div class="connector-row"><span class="connector-logo">OS</span><div class="copy"><h3>OpenStax open textbooks</h3><p>52 openly licensed textbooks that agents can cite. Managed by Microsoft, so there's nothing to connect.</p>${feeds('Teach, Study and Learn')}</div>${badge(state.openstax ? 'On' : 'Off', state.openstax ? 'good' : 'neutral')}</div>
      ${toggle('openstax', 'Use OpenStax in agents', state.openstax)}
      <div class="actions">${toggle('openstaxTeach', 'Teach · educators', state.openstaxTeach, !state.openstax)}${toggle('openstaxStudy', 'Study and Learn · students', state.openstaxStudy, !state.openstax)}</div>
      ${state.canvas ? `<div class="connector-row"><span class="connector-logo">CA</span><div class="copy"><h3>Canvas</h3><p>214 classes · Courses, assignments, due dates, rubrics and submission status</p>${feeds('Teach, Study and Learn, Class Insight Agent')}</div>${badge('Connected', 'good')}${button('Manage', 'canvas-manage')}</div>` : ''}
      ${state.connections.filter(id => id !== 'curriculum').map(id => { const entry = catalogs.find(item => item[0] === id); return `<div class="connector-row"><span class="connector-logo">${entry[1]}</span><div class="copy"><h3>${entry[2]}</h3><p>${entry[3]} · Simulated connection</p>${feeds(entry[4])}</div>${badge('Connected', 'good')}${button('Disconnect', 'disconnect', false, `data-id="${id}"`)}</div>`; }).join('')}</section>
      ${!state.canvas ? `<section class="card padded recommendation"><div class="section-head"><h2>Connect Canvas to your agents</h2>${badge('Recommended', 'info')}</div><p class="small">Your agents can't see Canvas data yet. Connecting gives Teach and Study and Learn courses, assignments, due dates and rubrics, and gives Class Insight Agent submission status.</p>${feeds('Teach, Study and Learn, Class Insight Agent')}<div class="actions" style="margin-top:18px">${button('Connect Canvas', 'canvas', true)}</div></section>` : ''}
      <h2 style="margin:24px 0 16px">Available agent connectors</h2><div class="connector-grid">${catalogs.map(([id, logo, name, description, agents]) => `<section class="card"><span class="connector-logo">${logo}</span><h3>${name}</h3><p>${description}</p>${feeds(agents)}${id === 'curriculum' ? curriculumLink('Manage curriculum sites') : button(state.connections.includes(id) ? 'Connected' : id === 'custom' ? 'Add server' : 'Connect', 'connect', false, `data-id="${id}" ${state.connections.includes(id) ? 'disabled' : ''}`)}</section>`).join('')}</div>
      <section class="card padded"><div class="section-head"><h2>School Data Sync</h2>${button('Open School Data Sync', 'sds')}</div><p class="small">Manage users, groups, classes and enrollments from your student information system in School Data Sync. Agent connectors supply learning data; they do not provision identities. Sync status and error management stay in the SDS portal.</p><p class="small" style="margin-top:12px">Review age-group counts in Student safety. Automatic refresh after roster changes is proposed and subject to engineering validation. This demo does not run live roster sync.</p>${link('Review student age groups', 'safety')}</section>`;
  }
  function makeWizard() {
    return { step: 0, institution: state.institution, source: state.source, groups: state.groups.map(groups => [...groups]), grades: [...state.grades], apps: { ...state.apps }, classify: !state.classified, canvas: true };
  }
  function changes() {
    const list = [];
    if (wizard.institution !== state.institution) list.push(`Set institution type to ${institutionLabels[wizard.institution]}`);
    if (wizard.groups.some((groups, index) => JSON.stringify([...groups].sort()) !== JSON.stringify([...state.groups[index]].sort()))) list.push('Update Microsoft Entra group mappings');
    if (wizard.grades.some((age, index) => age !== state.grades[index])) list.push('Update School Data Sync grade mappings');
    if (wizard.classify && !state.classified) list.push(`Classify 3,412 sample students using ${sourceLabels[wizard.source]} (illustrative)`);
    apps.forEach(([id, title]) => { if (wizard.apps[id] !== state.apps[id]) list.push(`${wizard.apps[id] ? 'Turn on' : 'Turn off'} ${title}`); });
    if (wizard.canvas !== state.canvas) list.push(`${wizard.canvas ? 'Connect' : 'Disconnect'} Canvas agent data`);
    return list;
  }
  function wizardScreen() {
    const top = heading('Guided setup', 'Set up Microsoft Education for your district. See what is set today next to your proposed changes. Only differences are applied, to sample data only.') + integrationNote();
    if (successCount !== null) return top + `<section class="card padded"><div class="success-mark" aria-hidden="true">&#10003;</div><h2>${successCount} sample changes applied</h2><p style="margin:12px 0 24px">Sample settings are saved in this browser. Age-group counts and readiness have updated automatically to reflect saved classifications. No real tenant was modified; production audit coverage remains to be validated.</p>${assessmentSummary()}${freshnessNote()}<div class="actions" style="margin-top:20px">${link('View tenant readiness', 'overview', true)}${button('Review settings again', 'wizard-restart')}</div></section>`;
    if (!wizard) wizard = makeWizard();
    const titles = ['Institution type', 'Student age groups', 'AI experiences', 'Connect data', 'Review & apply'];
    let body = '';
    if (wizard.step === 0) body = `<h2>What kind of institution is this?</h2><p>Current: ${institutionLabels[state.institution]}. Institution type sets the defaults for education experiences.</p><div role="radiogroup" aria-label="Setup institution type">${institutions(wizard.institution, 'w-institution')}</div>`;
    if (wizard.step === 1) body = `<h2>Classify students by age group</h2><p>Choose a method for this sample operation. Other methods remain available.</p>${assessmentSummary()}${freshnessNote()}<p class="small" style="margin-top:12px">Counts reflect saved tenant data only. Your setup selections do not affect counts until you select Apply.</p>${sourceOptions(wizard.source, 'w-source')}${mappings(wizard.source, wizard, 'w-')}${!state.classified ? `<label class="option"><input type="checkbox" data-w-field="classify" ${wizard.classify ? 'checked' : ''}><span>Classify 3,412 sample students when applying (fixed illustrative result)</span></label>` : ''}`;
    if (wizard.step === 2) body = `<h2>Choose AI experiences</h2><p>Current settings are pre-filled. Change only what you need for your institution. <strong>New</strong> marks new admin controls in this concept, not newly released apps or shipping availability.</p>${apps.map(app => appSetting(app, wizard.apps, true)).join('')}`;
    if (wizard.step === 3) body = `<h2>Bring in learning data</h2><p>Connect Canvas to give agents access to learning data. Roster and identity management stay in School Data Sync.</p><label class="option box"><input type="checkbox" data-w-field="canvas" ${wizard.canvas ? 'checked' : ''}><span><strong>Connect Canvas to agents</strong><p>Courses, assignments, rubrics and submission status for 214 classes. This demo simulates consent.</p></span></label>${curriculumSummary()}<div class="callout">OpenStax is ${state.openstax ? 'on' : 'off'}. Change its agent availability from Connectors &amp; data.</div>`;
    if (wizard.step === 4) {
      const list = changes();
      body = `<h2>Review ${list.length} changes</h2><p>Compare with the current sample tenant. Counts reflect saved data, not the proposed changes below. They update automatically after you select Apply.</p>${assessmentSummary()}${freshnessNote()}${wizard.source === 'csv' && wizard.classify && !state.csvReady ? '<div class="error" role="alert">Return to Student age groups and load the sample CSV before applying classification.</div>' : ''}${list.length ? `<ul class="change-list">${list.map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : '<div class="callout">Everything already matches. There are no changes to apply.</div>'}`;
    }
    const canApply = changes().length && !(wizard.source === 'csv' && wizard.classify && !state.csvReady);
    return top + `<section class="card wizard"><ol class="steps" aria-label="Setup steps">${titles.map((title, index) => `<li><button class="step" data-step="${index}" ${wizard.step === index ? 'aria-current="step"' : ''}><span>${index + 1}</span>${escape(title)}</button></li>`).join('')}</ol><div class="wizard-body"><span class="eyebrow">Step ${wizard.step + 1} of 5</span>${body}<div class="wizard-foot">${link('Exit setup', 'overview')}<div class="actions">${wizard.step > 0 ? button('Back', 'wizard-back') : ''}${wizard.step < 4 ? button('Next', 'wizard-next', true) : button(`Apply ${changes().length} changes`, 'wizard-apply', true, canApply ? '' : 'disabled')}</div></div></div></section><p class="small">Setup selections stay in this tab when you leave and return. Applied sample settings are saved in this browser. Draft selections are lost on reload.</p>`;
  }
  function route() {
    const id = location.hash.slice(1);
    if (id === 'curriculum') return 'connectors';
    return ['overview', 'safety', 'apps', 'connectors', 'setup'].includes(id) ? id : 'overview';
  }
  function render(focus = false) {
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('#theme').textContent = `Switch to ${state.theme === 'light' ? 'dark' : 'light'} theme`;
    const screen = route();
    document.querySelectorAll('[data-nav]').forEach(anchor => {
      if (anchor.dataset.nav === screen) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    });
    if (focus) document.querySelector('#education-menu').open = true;
    main.innerHTML = (storageProblem ? `<div class="error" role="alert">${escape(storageProblem)}</div>` : '') + ({ overview, safety, apps: appScreen, connectors, setup: wizardScreen }[screen])();
    document.title = `${screen === 'overview' ? 'Education' : { safety: 'Student safety', apps: 'Apps & agents', connectors: 'Connectors & data', setup: 'Guided setup' }[screen]} | Admin Hub concept`;
    if (focus) {
      main.focus({ preventScroll: true }); window.scrollTo(0, 0);
      if (location.hash === '#curriculum') {
        const section = main.querySelector('#curriculum-grounding');
        section.scrollIntoView({ block: 'start' });
        section.focus({ preventScroll: true });
      }
    }
  }
  function openDialog(title, content, confirmLabel, confirm) {
    dialog.innerHTML = `<h2 id="dialog-title">${escape(title)}</h2>${content}<div class="actions">${button('Cancel', 'dialog-cancel')}${confirmLabel ? button(confirmLabel, 'dialog-confirm', true) : button('Close', 'dialog-cancel')}</div>`;
    dialog.querySelectorAll('[data-action="dialog-cancel"]').forEach(button => { button.onclick = () => dialog.close(); });
    const confirmButton = dialog.querySelector('[data-action="dialog-confirm"]');
    if (confirmButton) confirmButton.onclick = () => { if (confirm() !== false) dialog.close(); };
    dialog.showModal();
  }
  function classificationDialog() {
    const before = ageCounts(), after = ageCounts(true);
    openDialog('Preview student classification', `<p>Source: <strong>${sourceLabels[state.source]}</strong>. This is an illustrative sample result, not a calculation of eligibility from real students or your mappings.</p><div class="mapping">${['Minor', 'Not adult', 'Adult', 'Unclassified'].map((label, index) => `<div class="mapping-row"><strong>${label}</strong><span>${before[index].toLocaleString()} → ${after[index].toLocaleString()}</span></div>`).join('')}</div><p>${state.classified ? 'Classification has already been applied. Counts are up to date.' : 'Counts and readiness update automatically after applying sample classification.'} No personal data is read or written.</p>${freshnessNote()}`, state.classified ? null : 'Apply sample classification', () => {
      state.classified = true; record(`Classified 3,412 sample students using ${sourceLabels[state.source]}`); finish('Sample classification complete. Age-group counts and readiness updated automatically.');
    });
  }
  function connectionDialog(id) {
    const entry = id === 'canvas' ? ['canvas', 'CA', 'Canvas', 'LMS agent data', 'Teach, Study and Learn, Class Insight Agent'] : catalogs.find(item => item[0] === id);
    if (!entry) return;
    const custom = id === 'custom';
    openDialog(`Connect ${entry[2]}`, `<p>This simulates admin consent. No sign-in, credentials or network requests are made.</p><h3>Review data access</h3><ul class="change-list">${(custom ? ['Admin-reviewed read-only tools', 'Authorized sample data only'] : ['Courses and curriculum content', 'Assignments, due dates and rubrics', ...(id === 'canvas' ? ['Submission status for Class Insight Agent'] : [])]).map(text => `<li>${text}</li>`).join('')}</ul>${feeds(entry[4])}${custom ? '<label class="field">Sample HTTPS endpoint<input type="url" id="endpoint" placeholder="https://example.org/mcp" autocomplete="off"></label><p>Use a fictional endpoint only. It is validated locally and never contacted or saved.</p><div id="endpoint-error" class="error" role="alert" hidden></div>' : ''}<div class="callout">Existing user permissions still apply in the concept.</div>`, 'Connect sample data', () => {
      if (custom) {
        const field = dialog.querySelector('#endpoint');
        let valid = false;
        try { const url = new URL(field.value); valid = url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
        catch (error) { if (!(error instanceof TypeError)) throw error; }
        if (!valid) {
          const error = dialog.querySelector('#endpoint-error'); error.textContent = 'Enter a valid HTTPS endpoint without credentials, for example https://example.org/mcp.'; error.hidden = false; field.focus(); return false;
        }
      }
      if (id === 'canvas') state.canvas = true;
      else if (!state.connections.includes(id)) state.connections.push(id);
      record(`Connected ${entry[2]} to agents (simulated)`); finish(`${entry[2]} connected to sample data.`);
    });
  }
  const actions = {
    'curriculum-add': () => {
      curriculumDraft.urls.push(''); curriculumErrors.push('');
      render(false);
      main.querySelector(`#curriculum-url-${curriculumDraft.urls.length - 1}`).focus();
    },
    'curriculum-remove': target => {
      curriculumDraft.urls.splice(Number(target.dataset.index), 1);
      curriculumErrors = []; curriculumGeneralError = '';
      render(false);
      main.querySelector('[data-action="curriculum-add"]').focus();
    },
    'curriculum-cancel': () => {
      curriculumDraft = { enabled: state.curriculum.enabled, urls: [...state.curriculum.urls] };
      curriculumErrors = []; curriculumGeneralError = '';
      render(false);
      main.querySelector('#curriculum-enabled').focus();
      notify('Curriculum edits canceled. Saved configuration is unchanged.');
    },
    'curriculum-save': () => {
      const result = validateCurriculum(curriculumDraft);
      curriculumErrors = result.errors; curriculumGeneralError = result.general;
      if (result.general || result.errors.some(error => error)) {
        render(false);
        (main.querySelector('[data-curriculum-url][aria-invalid="true"]') || main.querySelector('[data-action="curriculum-add"]')).focus();
        notify('Curriculum settings were not saved. Review the highlighted URL errors.');
        return;
      }
      state.curriculum = { enabled: curriculumDraft.enabled, urls: result.urls };
      state.connections = state.connections.filter(id => id !== 'curriculum');
      curriculumDraft = { enabled: state.curriculum.enabled, urls: [...state.curriculum.urls] };
      record(`${state.curriculum.enabled ? 'Enabled' : 'Disabled'} curriculum grounding for Teach module with ${state.curriculum.urls.length} saved sites (demo configuration only)`);
      finish(state.curriculum.enabled ? 'Curriculum configuration saved for Teach module. SharePoint access is not verified in this demo.' : 'Curriculum grounding disabled. Saved SharePoint URLs are retained.');
      main.querySelector('#curriculum-enabled').focus();
    },
    'admin-context': target => openDialog(`${target.dataset.adminArea} — navigation context`, '<p>This area is shown to place Education within the Microsoft 365 admin center menu. Its management features are outside this demo.</p><p>Expand Education to explore the working prototype. No live tenant is connected.</p>', null),
    'csv-preview': () => openDialog('Review sample CSV', '<p>Illustrative rows from a fictional 3,412-student import. Validation and upload are simulated, not performed on a real file.</p><pre class="csv-sample">sampleUserId,ageGroup\nsample-001,Minor\nsample-002,Not adult\nsample-003,Minor</pre><div class="callout">Sample validation: required columns present, no duplicate sample identifiers, and recognized age-group values. The full cohort uses fixed illustrative counts.</div>', 'Simulate CSV upload', () => {
      state.csvReady = true; record('Validated sample CSV for manual classification (simulated)'); finish('Sample CSV is ready. You can now preview classification.');
    }),
    classify: classificationDialog,
    audit: () => openDialog('Audit log handoff', '<p>In the product, this opens the existing audit experience. No live audit log is connected to this demo.</p><div class="callout"><strong>Coverage to validate</strong><p>Confirm logging for institution-type changes, age-group policies, and app/agent settings. Validate support for an Education-filtered destination and track missing event coverage as requirements.</p></div><p>A separate Recent changes feed is deferred. Demo activity is not evidence of production audit coverage.</p>', null),
    sds: () => openDialog('Open School Data Sync', '<p>This is a portal handoff, not embedded SDS management. No live service is connected in this demo.</p><p>Manage roster sync, import errors, users, groups, classes and enrollments in the SDS portal.</p><a class="btn primary" href="https://sds.microsoft.com/" target="_blank" rel="noopener noreferrer">Open SDS portal &#8599;</a>', null),
    scope: () => openDialog('Scope & dependencies', `<p>Proposed planning structure, not committed release scope or shipping availability.</p><h3>Preferred navigation</h3><p>One Education top-level item for education tenants only, with second-level destinations. MAC approval and tenant targeting require validation. If not approved, use a consolidated Education page under Org settings.</p><h3>Core candidates</h3><p>Institution type, age-group visibility, group classification, existing CSV capability, simple app controls, standalone guided setup, and agent connectors. Ordering depends on engineering estimates.</p><h3>Explorations</h3><p>Microsoft 365 guided setup integration, automatic counts, and dynamic-group implementation. Grade and birth-date provisioning engines require separate costing.</p><h3>Deferred candidates</h3><p>Custom Recent changes feed, embedded SDS reporting, North Harbor settings, and broader Teams/Exchange policy consolidation.</p><h3>Dependencies</h3><p>MAC placement and tenant targeting; classification precedence, writes, and update cadence; supported attributes, group types, and licensing; audit coverage and filtered destinations.</p><h3>Apps & agents validation</h3><p>Confirm service-specific educator/student sub-controls and Microsoft Classroom requirements with the owning team. Current simple controls remain unchanged.</p><h3>Sources / references</h3><p>Education Admin Hub concept, existing GitHub prototype, and owner-approved feedback-review updates, October 22, 2026. Internal source documents are not included in this public-ready demo.</p>`, null),
    canvas: () => connectionDialog('canvas'),
    'canvas-manage': () => openDialog('Manage Canvas agent data', `<p>Connected to 214 sample classes for Teach, Study and Learn and Class Insight Agent.</p><div class="callout">Disconnecting removes agent access to Canvas data.</div>`, 'Disconnect agent data', () => {
      state.canvas = false; record('Disconnected Canvas agent data'); finish('Canvas agent data disconnected.');
    }),
    'wizard-next': () => { wizard.step = Math.min(4, wizard.step + 1); render(true); },
    'wizard-back': () => { wizard.step = Math.max(0, wizard.step - 1); render(true); },
    'wizard-restart': () => { wizard = makeWizard(); successCount = null; render(true); },
    'wizard-apply': () => {
      const list = changes();
      if (!list.length || (wizard.source === 'csv' && wizard.classify && !state.csvReady)) return;
      state.institution = wizard.institution; state.source = wizard.source;
      state.groups = wizard.groups.map(groups => [...groups]); state.grades = [...wizard.grades]; state.apps = { ...wizard.apps };
      if (wizard.classify) state.classified = true;
      state.canvas = wizard.canvas;
      list.forEach(text => record(`${text} (guided setup)`));
      successCount = list.length; wizard = null;
      finish(`${list.length} sample changes applied.`);
    }
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-curriculum-link]')) {
      event.preventDefault();
      if (location.hash === '#curriculum') render(true);
      else location.hash = 'curriculum';
      return;
    }
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.method) {
      const model = target.dataset.methodContext === 'w-source' ? wizard : state;
      model.source = target.dataset.method;
      render(false);
      main.querySelector(`[data-method="${model.source}"]`)?.focus({ preventScroll: true });
    }
    if (target.dataset.action && actions[target.dataset.action]) actions[target.dataset.action](target);
    if (target.dataset.action === 'connect') connectionDialog(target.dataset.id);
    if (target.dataset.action === 'disconnect') {
      const id = target.dataset.id;
      const entry = catalogs.find(item => item[0] === id);
      openDialog(`Disconnect ${entry[2]}?`, '<p>This removes the simulated agent connection only.</p>', 'Disconnect', () => {
        state.connections = state.connections.filter(item => item !== id); record(`Disconnected ${entry[2]}`); finish('Sample connection removed.');
      });
    }
    if (target.dataset.step !== undefined) { wizard.step = Number(target.dataset.step); render(true); }
    if (target.dataset.filter) { filter = target.dataset.filter; render(false); document.querySelector(`[data-filter="${filter}"]`).focus(); }
  });
  document.addEventListener('input', event => {
    const input = event.target;
    if (input.hasAttribute('data-curriculum-url')) {
      const index = Number(input.dataset.curriculumUrl);
      curriculumDraft.urls[index] = input.value;
      curriculumErrors[index] = '';
      input.setAttribute('aria-invalid', 'false');
      main.querySelector(`#curriculum-error-${index}`).hidden = true;
      updateCurriculumDraftControls();
      return;
    }
    if (!input.hasAttribute('data-group-search')) return;
    const picker = input.closest('.group-picker');
    let matches = 0;
    picker.querySelectorAll('[data-group-option]').forEach(option => {
      option.hidden = !option.dataset.groupOption.includes(input.value.trim().toLowerCase());
      if (!option.hidden) matches++;
    });
    picker.querySelector('[data-no-groups]').hidden = matches !== 0;
  });
  document.addEventListener('change', event => {
    const input = event.target;
    const focusId = input.id;
    if (input.hasAttribute('data-curriculum-enabled')) {
      curriculumDraft.enabled = input.checked;
      if (input.checked && !curriculumDraft.urls.length) curriculumDraft.urls.push('');
      curriculumErrors = []; curriculumGeneralError = '';
      render(false);
    } else if (input.dataset.app) {
      const model = input.hasAttribute('data-wizard') ? wizard.apps : state.apps;
      model[input.dataset.app] = input.checked;
      if (!model.study) model.preselect = false;
      if (input.hasAttribute('data-wizard')) render(false);
      else { record(`${input.checked ? 'Turned on' : 'Turned off'} ${apps.find(app => app[0] === input.dataset.app)[1]}${input.dataset.app === 'study' && !input.checked ? '; pre-selection also cleared' : ''}`); finish('Sample app setting saved.'); }
    } else if (input.hasAttribute('data-group-index')) {
      const model = input.dataset.groupContext === 'w-' ? wizard : state;
      const index = Number(input.dataset.groupIndex);
      model.groups[index] = input.checked ? [...new Set([...model.groups[index], input.value])] : model.groups[index].filter(group => group !== input.value);
      input.closest('.group-picker').querySelector('summary').textContent = model.groups[index].join(', ') || 'Select groups';
      if (model === state) { record('Updated Entra group mappings'); persist(); notify(storageProblem || 'Sample group mapping saved.'); }
      return;
    } else if (input.name === 'institution') {
      state[input.name] = input.value; record(`Set ${input.name} to ${input.name === 'institution' ? institutionLabels[input.value] : sourceLabels[input.value]}`); finish('Sample setting saved.');
    } else if (input.name === 'w-institution' || input.name === 'w-source') { wizard[input.name.slice(2)] = input.value; render(false); }
    else if (input.dataset.wField) { wizard[input.dataset.wField] = input.checked; }
    else if (input.dataset.map) {
      const isWizard = input.dataset.map.startsWith('w-');
      const model = isWizard ? wizard : state;
      const key = isWizard ? input.dataset.map.slice(2) : input.dataset.map;
      model[key][Number(input.dataset.index)] = input.value;
      if (!isWizard) { record(`Updated ${key === 'groups' ? 'Entra group' : 'grade'} mapping`); finish('Sample mapping saved.'); }
    } else if (input.dataset.toggle) {
      state[input.dataset.toggle] = input.checked; record(`${input.checked ? 'Enabled' : 'Disabled'} ${input.dataset.toggle} for agents`); finish('OpenStax sample setting saved.');
    } else return;
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (input.name) main.querySelector(`input[name="${input.name}"][value="${input.value}"]`)?.focus({ preventScroll: true });
  });
  document.querySelector('#reset').addEventListener('click', () => {
    openDialog('Reset this demo?', '<p>Restore the original sample tenant, clear the demo audit history and restart guided setup. No real tenant data is affected.</p>', 'Reset demo', () => {
      state = defaults(); wizard = null; successCount = null; filter = 'all';
      curriculumDraft = null; curriculumErrors = []; curriculumGeneralError = '';
      persist();
      location.hash = 'overview'; render(true); notify(storageProblem || 'Demo reset to the original sample tenant.');
    });
  });
  document.querySelector('#theme').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; finish('Theme updated.'); });
  document.querySelector('#nav-toggle').addEventListener('click', () => setNavigationExpanded(document.querySelector('#nav-toggle').getAttribute('aria-expanded') !== 'true'));
  document.querySelector('#admin-menu').addEventListener('click', event => {
    if (event.target.closest('[data-nav]') && matchMedia('(max-width: 720px)').matches) setNavigationExpanded(false);
  });
  document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); });
  window.addEventListener('hashchange', () => render(true));
  if ((assessmentNeedsSaving || state.ageAssessment.unclassified !== ageCounts()[3]) && !storageProblem) persist();
  render(location.hash === '#curriculum');
})();
