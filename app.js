'use strict';

(() => {
  const storageKey = 'education-admin-hub-v2';
  const assessmentInterval = 24 * 60 * 60 * 1000;
  const main = document.querySelector('main');
  const dialog = document.querySelector('dialog');
  const apps = [
    ['study', 'Study and Learn agent', "Makes the Study and Learn agent available to students in Copilot Chat. When off, students can't use it and it can't be pre-selected.", 'Students', 'Education', 'cp'],
    ['preselect', 'Pre-select Study and Learn agent in Copilot Chat', 'Students get coaching that helps them work through questions without receiving answers or completed work.', 'Students', 'Education', 'cp'],
    ['teach', 'Teach module', 'Lesson planning, differentiation, rubrics and assessment drafting, grounded in connected curriculum.', 'Educators', 'Copilot', 'cp'],
    ['insights', 'Educator Insights agent', "Educators ask questions about their own classes' progress, based on roster, assignment and LMS data.", 'Educators', 'Copilot', 'cp'],
    ['reading', 'Reading Coach', 'Personalized, AI-powered stories and independent reading fluency practice.', 'Students', 'Education', 'la'],
    ['progress', 'Reading Progress', 'Recorded reading fluency assignments in Teams.', 'Everyone', 'Teams', 'la'],
    ['search', 'Search Coach', 'Helps students form effective queries and judge source reliability.', 'Everyone', 'Teams', 'la'],
    ['speaker', 'Speaker Progress', 'Presentation practice with feedback on pace, filler words and more.', 'Everyone', 'Teams', 'la'],
    ['math', 'Math Progress', 'Practice problem sets with step-by-step feedback.', 'Everyone', 'Teams', 'la']
  ];
  const catalogs = [
    ['schoology', 'SC', 'Schoology', 'MCP server', 'Teach, Study and Learn, Insights'],
    ['moodle', 'MO', 'Moodle', 'MCP server', 'Teach, Study and Learn, Insights'],
    ['brightspace', 'BS', 'D2L Brightspace', 'MCP server', 'Teach, Study and Learn, Insights'],
    ['curriculum', 'DL', 'District curriculum library', 'SharePoint · Copilot connector', 'Teach, Study and Learn'],
    ['standards', 'ST', 'State standards', 'Standards alignment for lessons', 'Teach'],
    ['custom', '+', 'Custom MCP server', 'Your own or a partner endpoint', 'Requires Entra app registration and admin review of each tool.']
  ];
  const sourceLabels = { groups: 'Microsoft Entra groups', grades: 'Grade level from School Data Sync', birth: 'Birth date from School Data Sync', csv: 'Manual (CSV upload)' };
  const institutionLabels = { k12: 'K-12', higher: 'Higher education', other: 'Other' };
  const groupOptions = ['Elementary students', 'Middle school students', 'High school students', 'Running Start students', 'Unclassified student cohort'];
  const defaults = () => ({
    version: 2, institution: 'k12', source: 'groups', classified: false, sdsHealthy: false,
    canvas: false, openstax: true, openstaxTeach: true, openstaxStudy: true, csvReady: false,
    groups: ['Elementary students', 'Middle school students', 'Running Start students'],
    grades: ['Minor', 'Not adult', 'Not adult', 'Adult'],
    apps: Object.fromEntries(apps.map(([id]) => [id, id !== 'math'])),
    connections: [], theme: 'light',
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
        Array.isArray(parsed.groups) && parsed.groups.length === 3 && parsed.groups.every(group => groupOptions.includes(group)) &&
        Array.isArray(parsed.grades) && parsed.grades.length === 4 && parsed.grades.every(age => ['Minor', 'Not adult', 'Adult'].includes(age)) &&
        Array.isArray(parsed.connections) && parsed.connections.every(id => catalogs.some(item => item[0] === id)) &&
        Array.isArray(parsed.audit) && parsed.audit.every(item => typeof item.text === 'string' && typeof item.time === 'string') &&
        ['light', 'dark'].includes(parsed.theme) && (parsed.csvReady === undefined || typeof parsed.csvReady === 'boolean') &&
        (parsed.ageAssessment === undefined || (parsed.ageAssessment &&
          [0, 3412].includes(parsed.ageAssessment.unclassified) &&
          Number.isSafeInteger(parsed.ageAssessment.checkedAt) && parsed.ageAssessment.checkedAt > 0 &&
          parsed.ageAssessment.checkedAt <= 8640000000000000));
      if (!valid || (!parsed.apps.study && parsed.apps.preselect)) throw new Error('Saved demo state has an unsupported shape.');
      state = { ...base, ...parsed };
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
  let toastTimer;
  let assessmentTimer;
  let recalculateTimer;
  let recalculating = false;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const badge = (label, kind = 'neutral') => `<span class="badge ${kind}">${escape(label)}</span>`;
  const button = (label, action, primary = false, extra = '') => `<button class="btn${primary ? ' primary' : ''}" data-action="${action}" ${extra}>${escape(label)}</button>`;
  const link = (label, target, primary = false) => `<a class="btn${primary ? ' primary' : ''}" href="#${target}">${escape(label)}</a>`;
  const feeds = names => `<div class="feeds">${names.split(', ').map(name => `<span class="feed">${escape(name)}</span>`).join('')}</div>`;
  const heading = (title, description, action = '') => `<div class="crumb">Settings &rsaquo; Education${title === 'Education' ? '' : ` &rsaquo; ${escape(title)}`}</div><div class="page-head"><div><h1>${escape(title)}</h1><p class="lede">${escape(description)}</p></div>${action}</div>`;
  const ageCounts = (classified = state.classified) => classified ? [10804, 8014, 122, 0] : [9104, 6302, 122, 3412];
  const assessedAgeCounts = () => ageCounts(state.ageAssessment.unclassified === 0);
  const assessmentPending = () => state.ageAssessment.unclassified !== ageCounts()[3];
  const recalculateButton = context => button(recalculating ? 'Recalculating...' : 'Recalculate now', 'recalculate', false, `data-recalculate-context="${context}" ${recalculating ? 'disabled' : ''}`);
  function assessmentControls(context) {
    const date = new Date(state.ageAssessment.checkedAt);
    return `<div class="count-assessment" aria-busy="${recalculating}"><p class="small muted">Last checked <time datetime="${date.toISOString()}">${escape(date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time> · Refreshes automatically every 24 hours.</p>
      ${assessmentPending() ? '<p class="small"><strong>Classification has changed. Recalculate to see the impact now.</strong></p>' : ''}
      <div style="margin-top:10px">${recalculateButton(context)}</div></div>`;
  }
  function assessmentSummary(context) {
    return `<div class="callout"><strong>${state.ageAssessment.unclassified.toLocaleString()} unclassified students at the last check</strong>${assessmentControls(context)}</div>`;
  }
  function updateAgeAssessment() {
    state.ageAssessment = { unclassified: ageCounts()[3], checkedAt: Date.now() };
  }

  function notify(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
  }
  function persist() {
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
      [state.sdsHealthy, 'Roster sync', state.sdsHealthy ? 'Sample sync completed just now · No failed records' : 'School Data Sync last ran 3 days ago · 27 student records failed to import', 'connectors', 'Review errors', 'Needs review'],
      [state.canvas, 'Learning data connections', state.canvas ? 'Canvas data is available to the selected agents in this demo' : "Canvas is used in 214 classes through LTI but isn't connected to Teach or Study and Learn", 'connectors', 'Connect Canvas', 'Recommended'],
      [true, 'Institution type', `${institutionLabels[state.institution]} · set by your admin`, 'safety', 'View', ''],
      [state.apps.study && state.apps.preselect && state.apps.reading, 'AI experiences', `Study and Learn ${state.apps.study ? 'available' : 'off'} · Pre-selection ${state.apps.preselect ? 'on' : 'off'} · Reading Coach ${state.apps.reading ? 'on' : 'off'}`, 'apps', 'View', 'Needs review']
    ];
  }
  function auditRows(all = false) {
    return `<ul class="change-list">${state.audit.slice(0, all ? 60 : 3).map(entry => `<li><span style="flex:1">${escape(entry.text)}</span><span class="muted small">District admin · ${escape(entry.time)}</span></li>`).join('')}</ul>`;
  }
  function overview() {
    const rows = readiness();
    const ready = rows.filter(row => row[0]).length;
    return heading('Education', 'Every setting that shapes teaching, learning and student safety for Contoso Unified School District, in one place. Changes made here sync with Teams, Entra and Purview in the concept; this demo changes sample data only.') +
      `<div class="tenant">${badge(institutionLabels[state.institution], 'info')}<span>18,940 students</span><span>1,612 educators</span><span>41 schools</span></div>
      <div style="height:24px"></div>
      ${state.ageAssessment.unclassified ? `<div class="banner"><span class="banner-icon" aria-hidden="true">&#9888;</span><div><strong>3,412 students don't have an age group yet</strong><p>Microsoft AI experiences use age group to decide what each student can access.</p>${assessmentControls('overview')}</div><div class="actions">${link('Start guided setup', 'setup', true)}${link('Review students', 'safety')}</div></div>` : `<div class="callout" style="margin-bottom:24px"><strong>All sample students have an age group</strong><p>0 unclassified students. Explore Apps &amp; agents or finish connecting learning data.</p>${assessmentControls('overview')}</div>`}
      <section class="card padded"><div class="section-head"><h2>Tenant readiness</h2>${link('Fix with guided setup', 'setup')}</div><p class="small">Checks age groups, roster sync, institution type, AI experiences and data connections</p>
      <div class="readiness"><div class="ring" style="--progress:${ready * 20}"><span>${ready}/5</span></div><div><h3>${ready} of 5 areas ready for students</h3><p>Student age groups use the last checked count. Recalculate above to refresh after classification.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Status</th><th>Area</th><th>What we found</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${rows.map(([ok, area, description, target, action, status], index) => `<tr><td>${badge(ok ? 'Ready' : status, ok ? 'good' : index === 0 ? 'bad' : index === 2 ? 'info' : 'warn')}</td><td><strong>${area}</strong></td><td><p>${escape(description)}</p></td><td>${index === 0 ? `${recalculateButton('readiness')}<br>` : ''}<a href="#${target}">${index === 0 && assessmentPending() ? 'Review classification' : ok ? 'View' : action}</a></td></tr>`).join('')}</tbody></table></div></section>
      <div class="tiles">${[
        ['safety', '&#9826;', 'Student safety', 'Institution type and student age groups', state.ageAssessment.unclassified === 0 ? 'All students classified' : assessmentPending() ? 'Recalculation needed' : '1 action needed'],
        ['apps', '&#8862;', 'Apps & agents', 'Copilot agents and Learning Accelerators', '9 settings'],
        ['connectors', '&#8644;', 'Connectors & data', 'Roster sync, LMS integrations and the data your agents use', `${Number(!state.sdsHealthy) + Number(!state.canvas)} to review`]
      ].map(([id, icon, title, description, status]) => `<a href="#${id}" class="card tile"><span class="tile-icon" aria-hidden="true">${icon}</span><h3>${escape(title)}</h3><p>${description}</p>${badge(status, 'info')}</a>`).join('')}</div>
      <section class="card padded"><div class="section-head"><h2>Recent changes</h2><button class="text-button" data-action="audit">View audit log</button></div>${auditRows()}</section>`;
  }
  function institutions(value, name) {
    return [['k12', 'K-12 (primary and secondary schools)'], ['higher', 'Higher education (colleges and universities)'], ['other', 'Other (research institution, academic library, etc.)']].map(([id, label]) =>
      `<label class="option"><input type="radio" name="${name}" value="${id}" ${value === id ? 'checked' : ''}><span>${escape(label)}</span></label>`).join('');
  }
  function sourceOptions(value, name) {
    const hints = {
      groups: 'Assign the groups you already manage, such as school or grade-band groups, to each age group.',
      grades: 'Everyone in a grade gets the same age group. Updates when students are promoted.',
      birth: 'Classifies by actual age. Students in the same grade may get different experiences.',
      csv: 'Review a sample CSV and simulate importing manually assigned age groups. No real files or student data are uploaded.'
    };
    return Object.entries(sourceLabels).map(([id, label]) => `<label class="option"><input type="radio" name="${name}" value="${id}" ${value === id ? 'checked' : ''}><span><strong>${label}</strong> ${id === 'groups' ? badge('Recommended', 'info') : ''}<p>${hints[id]}</p></span></label>`).join('');
  }
  function mappings(source, model, prefix) {
    if (source === 'groups') return `<h3>Assign groups to each age group</h3><div class="mapping">${['Minor', 'Not adult', 'Adult'].map((age, index) => `<label class="mapping-row"><strong>${age}</strong><select id="${prefix}group-${index}" aria-label="${age} group" data-map="${prefix}groups" data-index="${index}">${groupOptions.map(group => `<option ${model.groups[index] === group ? 'selected' : ''}>${group}</option>`).join('')}</select>${index === 1 ? '<span class="small muted">+ High school students</span>' : ''}</label>`).join('')}</div><p class="small">Membership is checked on every sync. Students in more than one group get the more protective age group. Sample mappings only.</p>`;
    if (source === 'grades') return `<h3>Grade mapping</h3><div class="mapping">${['Pre-K - Grade 6', 'Grades 7 - 8', 'Grades 9 - 12', 'Adult education'].map((band, index) => `<label class="mapping-row"><strong>${band}</strong><select id="${prefix}grade-${index}" aria-label="${band}" data-map="${prefix}grades" data-index="${index}">${['Minor', 'Not adult', 'Adult'].map(age => `<option ${model.grades[index] === age ? 'selected' : ''}>${age}</option>`).join('')}</select></label>`).join('')}</div><p class="small">Defaults follow your region's digital consent age. This demo uses illustrative mappings, not eligibility policy.</p>`;
    if (source === 'csv') return `<div class="callout"><strong>Manual classification</strong><p class="small">The demo simulates validating and importing a sample file. No actual upload is performed.</p><div class="actions" style="margin-top:12px">${badge(state.csvReady ? 'Sample CSV validated' : 'No sample CSV loaded', state.csvReady ? 'good' : 'warn')}${button('Review sample CSV', 'csv-preview')}</div></div>`;
    return '<div class="callout">Birth-date classification uses the date of birth from your SIS. This demo previews the method only; no real dates of birth are collected.</div>';
  }
  function safety() {
    const counts = assessedAgeCounts();
    return heading('Student safety', 'Tell us what kind of institution you are and classify your students by age group, so Microsoft AI experiences are appropriate for every student.') +
      `<section class="card padded"><div class="section-head"><h2>Institution type</h2>${badge('Saved in demo', 'neutral')}</div><p class="small">Your institution type sets the defaults for every education experience, including which AI features are on by default.</p><div role="radiogroup" aria-label="Institution type">${institutions(state.institution, 'institution')}</div></section>
      <section class="card padded"><div class="section-head"><h2>Student age groups</h2>${badge(counts[3] === 0 ? 'All classified' : '3,412 unclassified', counts[3] === 0 ? 'good' : 'bad')}</div><p class="small">Students are classified by their Microsoft Entra ID age group so AI experiences are appropriate for their age. Counts below reflect the last assessment.</p>
      <div class="stats">${['Minor', 'Not adult', 'Adult', 'Unclassified'].map((age, index) => `<div class="stat${index === 3 && counts[3] > 0 ? ' alert' : ''}"><span>${age}</span><strong>${counts[index].toLocaleString()}</strong></div>`).join('')}</div>
      <div class="breakdown" role="img" aria-label="${counts.map((count, index) => `${count} ${['minor', 'not adult', 'adult', 'unclassified'][index]}`).join(', ')}">${counts.map(count => `<span style="flex:${count};${count === 0 ? 'display:none' : ''}"></span>`).join('')}</div>
      ${assessmentControls('safety')}
      <h3 style="margin-top:24px">Classification source</h3><div role="radiogroup" aria-label="Classification source">${sourceOptions(state.source, 'source')}</div>
      ${mappings(state.source, state, '')}
      <div class="callout">Students without an age group are handled by the Copilot eligibility check. Classifying them gives them the experiences intended for their age group.</div>
      <div class="actions" style="margin-top:20px">${button(state.classified ? 'Preview classification' : 'Preview 3,412 classifications', 'classify', true, state.source === 'csv' && !state.csvReady ? 'disabled' : '')}${recalculateButton('safety-actions')}<span class="small muted">${state.source === 'csv' && !state.csvReady ? 'Load the sample CSV before classifying students.' : state.classified ? assessmentPending() ? 'Classification applied. Recalculate to refresh these counts.' : 'Sample classification has already been applied.' : 'Preview and confirm before applying sample changes.'}</span></div></section>`;
  }
  function appSetting(app, model = state.apps, wizardMode = false) {
    const [id, title, description, audience, source] = app;
    const disabled = id === 'preselect' && !model.study;
    return `<div class="setting"><div class="copy"><label for="${wizardMode ? 'w-' : ''}app-${id}">${title}</label><p>${description}${disabled ? ' Turn on Study and Learn to enable pre-selection.' : ''}</p></div><span class="small muted">${audience}</span><span class="source">${source}</span><input type="checkbox" role="switch" class="switch" id="${wizardMode ? 'w-' : ''}app-${id}" data-app="${id}" ${wizardMode ? 'data-wizard' : ''} ${model[id] ? 'checked' : ''} ${disabled ? 'disabled' : ''}></div>`;
  }
  function appScreen() {
    return heading('Apps & agents', 'Copilot agents and Learning Accelerators, gathered from Copilot settings and Microsoft Education settings.') +
      `<div class="filters" role="group" aria-label="Filter settings">${[['all', 'All settings'], ['cp', 'Copilot & agents'], ['la', 'Learning Accelerators']].map(([id, label]) => `<button class="btn" data-filter="${id}" aria-pressed="${filter === id}">${escape(label)}</button>`).join('')}</div>
      ${[['cp', 'Copilot & agents'], ['la', 'Learning Accelerators']].filter(([id]) => filter === 'all' || filter === id).map(([id, title]) => `<section class="card padded"><div class="section-head"><h2>${escape(title)}</h2>${badge('Saved automatically', 'neutral')}</div>${apps.filter(app => app[5] === id).map(app => appSetting(app)).join('')}</section>`).join('')}
      <div class="callout">Prototype controls only. Turning off Study and Learn also clears pre-selection. No tenant settings are changed. <a href="#safety">Review or recalculate student age groups in Student safety.</a></div>`;
  }
  function toggle(id, label, checked, disabled = false) {
    return `<label class="option"><input type="checkbox" id="toggle-${id}" data-toggle="${id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span>${label}</span></label>`;
  }
  function connectors() {
    return heading('Connectors & data', 'Keep rosters in sync, bring Microsoft experiences into your LMS, and connect the data your agents use. Each does a different job.') +
      `<div class="tiles flow">${[
        ['Roster & identity', 'School Data Sync', 'Your SIS → Entra ID & Teams', 'Users, groups, classes and enrollments. Drives accounts, class teams and age group classification.'],
        ['LMS integration', 'LTI 1.3 apps', 'Microsoft 365 → Your LMS', 'Teams meetings, Assignments, OneDrive and Learning Accelerators inside your LMS.'],
        ['Agent data', 'Agent connectors', 'LMS & content → Copilot agents', 'Courses, assignments, rubrics and curriculum for Teach, Study and Learn and Educator Insights.']
      ].map(([category, title, direction, description]) => `<div class="tile"><span class="eyebrow">${category}</span><h3>${title}</h3><strong class="small">${direction}</strong><p>${description}</p></div>`).join('')}</div>
      <section class="card padded"><div class="section-head"><h2>School Data Sync</h2>${badge(state.sdsHealthy ? 'Healthy' : '27 records failed', state.sdsHealthy ? 'good' : 'warn')}</div><p class="small">Creates and updates users, groups and classes from your student information system.</p>
      <div class="connector-row"><span class="connector-logo">SD</span><div class="copy"><h3>PowerSchool SIS via OneRoster</h3><p>18,940 students · 1,612 educators · 2,860 classes</p>${feeds('Users, Groups, Classes')}<p>${state.sdsHealthy ? 'Last sample sync: just now' : 'Last sync 3 days ago'}</p></div>${button(state.sdsHealthy ? 'View sync details' : 'Review 27 errors', 'sds')}</div>
      <p class="small">After syncing rosters or applying classification, recalculate student age-group counts. Recalculation checks saved data; it does not rerun roster sync or classify students.</p>${assessmentSummary('roster')}</section>
      <section class="card padded"><div class="section-head"><h2>LMS integrations</h2>${badge('LTI 1.3', 'neutral')}</div><p class="small">Apps that put Microsoft experiences inside your learning management system. Installing an LTI app does not connect agent data.</p>
      <div class="connector-row"><span class="connector-logo">CA</span><div class="copy"><h3>Canvas</h3><p>Used in 214 courses</p>${feeds('Teams meetings, Assignments, OneDrive, Reflect')}</div>${badge('Installed', 'good')}${button('View integration', 'lti')}</div>
      <p class="small">Schoology · Moodle · D2L Brightspace: not installed in this sample tenant.</p></section>
      <section class="card padded"><div class="section-head"><h2>Agent connectors</h2>${badge(`${Number(state.openstax) + Number(state.canvas) + state.connections.length} active`, 'info')}</div>
      <div class="connector-row"><span class="connector-logo">OS</span><div class="copy"><h3>OpenStax open textbooks</h3><p>52 openly licensed textbooks that agents can cite. Managed by Microsoft, so there's nothing to connect.</p>${feeds('Teach, Study and Learn')}</div>${badge(state.openstax ? 'On' : 'Off', state.openstax ? 'good' : 'neutral')}</div>
      ${toggle('openstax', 'Use OpenStax in agents', state.openstax)}
      <div class="actions">${toggle('openstaxTeach', 'Teach · educators', state.openstaxTeach, !state.openstax)}${toggle('openstaxStudy', 'Study and Learn · students', state.openstaxStudy, !state.openstax)}</div>
      ${state.canvas ? `<div class="connector-row"><span class="connector-logo">CA</span><div class="copy"><h3>Canvas</h3><p>214 classes · Courses, assignments, due dates, rubrics and submission status</p>${feeds('Teach, Study and Learn, Insights')}</div>${badge('Connected', 'good')}${button('Manage', 'canvas-manage')}</div>` : ''}
      ${state.connections.map(id => { const entry = catalogs.find(item => item[0] === id); return `<div class="connector-row"><span class="connector-logo">${entry[1]}</span><div class="copy"><h3>${entry[2]}</h3><p>${entry[3]} · Simulated connection</p>${feeds(entry[4])}</div>${badge('Connected', 'good')}${button('Disconnect', 'disconnect', false, `data-id="${id}"`)}</div>`; }).join('')}</section>
      ${!state.canvas ? `<section class="card padded recommendation"><div class="section-head"><h2>Connect Canvas to your agents</h2>${badge('Recommended', 'info')}</div><p class="small">Canvas is installed as an LTI app, so educators already use Microsoft tools inside it. Your agents can't see Canvas yet. Connecting gives Teach and Study and Learn courses, assignments, due dates and rubrics, and gives Educator Insights submission status.</p>${feeds('Teach, Study and Learn, Insights')}<div class="actions" style="margin-top:18px">${button('Connect Canvas', 'canvas', true)}</div></section>` : ''}
      <h2 style="margin:24px 0 16px">Available agent connectors</h2><div class="connector-grid">${catalogs.map(([id, logo, name, description, agents]) => `<section class="card"><span class="connector-logo">${logo}</span><h3>${name}</h3><p>${description}</p>${feeds(agents)}${button(state.connections.includes(id) ? 'Connected' : id === 'custom' ? 'Add server' : 'Connect', 'connect', false, `data-id="${id}" ${state.connections.includes(id) ? 'disabled' : ''}`)}</section>`).join('')}</div>`;
  }
  function makeWizard() {
    return { step: 0, institution: state.institution, source: state.source, groups: [...state.groups], grades: [...state.grades], apps: { ...state.apps }, classify: !state.classified, sync: !state.sdsHealthy, canvas: true };
  }
  function changes() {
    const list = [];
    if (wizard.institution !== state.institution) list.push(`Set institution type to ${institutionLabels[wizard.institution]}`);
    if (wizard.source !== state.source) list.push(`Set classification source to ${sourceLabels[wizard.source]}`);
    if (wizard.groups.some((group, index) => group !== state.groups[index])) list.push('Update Microsoft Entra group mappings');
    if (wizard.grades.some((age, index) => age !== state.grades[index])) list.push('Update School Data Sync grade mappings');
    if (wizard.classify && !state.classified) list.push('Classify 3,412 sample students');
    apps.forEach(([id, title]) => { if (wizard.apps[id] !== state.apps[id]) list.push(`${wizard.apps[id] ? 'Turn on' : 'Turn off'} ${title}`); });
    if (wizard.sync && !state.sdsHealthy) list.push('Retry 27 failed School Data Sync records');
    if (wizard.canvas !== state.canvas) list.push(`${wizard.canvas ? 'Connect' : 'Disconnect'} Canvas agent data`);
    return list;
  }
  function wizardScreen() {
    const top = heading('Guided setup', 'Set up Microsoft Education for your district. See what is set today next to your proposed changes. Only differences are applied, to sample data only.');
    if (successCount !== null) return top + `<section class="card padded"><div class="success-mark" aria-hidden="true">&#10003;</div><h2>${successCount} sample changes applied</h2><p style="margin:12px 0 24px">Settings and the audit log now reflect these changes. Recalculate here to see classification impact immediately, without waiting for the next 24-hour refresh. No real tenant was modified.</p>${assessmentSummary('setup-complete')}<div class="actions" style="margin-top:20px">${link('View tenant readiness', 'overview', true)}${button('Review settings again', 'wizard-restart')}</div></section>`;
    if (!wizard) wizard = makeWizard();
    const titles = ['Institution type', 'Student age groups', 'AI experiences', 'Connect data', 'Review & apply'];
    let body = '';
    if (wizard.step === 0) body = `<h2>What kind of institution is this?</h2><p>Current: ${institutionLabels[state.institution]}. Institution type sets the defaults for education experiences.</p><div role="radiogroup" aria-label="Setup institution type">${institutions(wizard.institution, 'w-institution')}</div>`;
    if (wizard.step === 1) body = `<h2>Classify students by age group</h2><p>Current classification source: ${sourceLabels[state.source]}.</p>${assessmentSummary('setup-age')}<p class="small" style="margin-top:12px">Recalculation checks saved tenant data only. Your setup selections are not applied until you select Apply.</p><div role="radiogroup" aria-label="Setup classification source">${sourceOptions(wizard.source, 'w-source')}</div>${mappings(wizard.source, wizard, 'w-')}${!state.classified ? `<label class="option"><input type="checkbox" data-w-field="classify" ${wizard.classify ? 'checked' : ''}><span>Classify 3,412 sample students when applying</span></label>` : ''}`;
    if (wizard.step === 2) body = `<h2>Choose AI experiences</h2><p>Current settings are pre-filled. Change only what you need for your institution.</p>${apps.map(app => appSetting(app, wizard.apps, true)).join('')}`;
    if (wizard.step === 3) body = `<h2>Bring in learning data</h2><p>School Data Sync drives identity. Canvas LTI is already installed, but agent data needs a separate connection.</p>${!state.sdsHealthy ? `<label class="option box"><input type="checkbox" data-w-field="sync" ${wizard.sync ? 'checked' : ''}><span><strong>Retry School Data Sync</strong><p>Simulate resolving 27 failed records.</p></span></label>` : badge('School Data Sync healthy', 'good')}<label class="option box"><input type="checkbox" data-w-field="canvas" ${wizard.canvas ? 'checked' : ''}><span><strong>Connect Canvas to agents</strong><p>Courses, assignments, rubrics and submission status for 214 classes. This demo simulates consent.</p></span></label><div class="callout">OpenStax is ${state.openstax ? 'on' : 'off'}. Change its agent availability from Connectors &amp; data.</div>`;
    if (wizard.step === 4) {
      const list = changes();
      body = `<h2>Review ${list.length} changes</h2><p>Compare with the current sample tenant. Nothing changes until you select Apply. Recalculation checks saved data, not the proposed changes below.</p>${assessmentSummary('setup-review')}${wizard.source === 'csv' && wizard.classify && !state.csvReady ? '<div class="error" role="alert">Return to Student age groups and load the sample CSV before applying classification.</div>' : ''}${list.length ? `<ul class="change-list">${list.map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : '<div class="callout">Everything already matches. There are no changes to apply.</div>'}`;
    }
    const canApply = changes().length && !(wizard.source === 'csv' && wizard.classify && !state.csvReady);
    return top + `<section class="card wizard"><ol class="steps" aria-label="Setup steps">${titles.map((title, index) => `<li><button class="step" data-step="${index}" ${wizard.step === index ? 'aria-current="step"' : ''}><span>${index + 1}</span>${escape(title)}</button></li>`).join('')}</ol><div class="wizard-body"><span class="eyebrow">Step ${wizard.step + 1} of 5</span>${body}<div class="wizard-foot">${link('Save and exit', 'overview')}<div class="actions">${wizard.step > 0 ? button('Back', 'wizard-back') : ''}${wizard.step < 4 ? button('Next', 'wizard-next', true) : button(`Apply ${changes().length} changes`, 'wizard-apply', true, canApply ? '' : 'disabled')}</div></div></div></section><p class="small">Setup selections stay in this tab when you leave and return. Applied sample settings are saved in this browser.</p>`;
  }
  function route() {
    const id = location.hash.slice(1);
    return ['overview', 'safety', 'apps', 'connectors', 'setup'].includes(id) ? id : 'overview';
  }
  function render(focus = false) {
    clearTimeout(assessmentTimer);
    if (Date.now() - state.ageAssessment.checkedAt >= assessmentInterval) {
      updateAgeAssessment();
      persist();
    }
    assessmentTimer = setTimeout(() => render(false), Math.min(assessmentInterval, Math.max(1, state.ageAssessment.checkedAt + assessmentInterval - Date.now())));
    document.documentElement.dataset.theme = state.theme;
    document.querySelector('#theme').textContent = `Switch to ${state.theme === 'light' ? 'dark' : 'light'} theme`;
    const screen = route();
    document.querySelectorAll('[data-nav]').forEach(anchor => {
      if (anchor.dataset.nav === screen) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    });
    main.innerHTML = (storageProblem ? `<div class="error" role="alert">${escape(storageProblem)}</div>` : '') + ({ overview, safety, apps: appScreen, connectors, setup: wizardScreen }[screen])();
    document.title = `${screen === 'overview' ? 'Education' : { safety: 'Student safety', apps: 'Apps & agents', connectors: 'Connectors & data', setup: 'Guided setup' }[screen]} | Admin Hub concept`;
    if (focus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
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
    openDialog('Preview student classification', `<p>Source: <strong>${sourceLabels[state.source]}</strong>. This is an illustrative sample result, not a calculation of eligibility from real students or your mappings.</p><div class="mapping">${['Minor', 'Not adult', 'Adult', 'Unclassified'].map((label, index) => `<div class="mapping-row"><strong>${label}</strong><span>${before[index].toLocaleString()} → ${after[index].toLocaleString()}</span></div>`).join('')}</div><p>${state.classified ? 'Classification has already been applied. Recalculate on Student safety to refresh the assessed counts.' : 'After applying, select Recalculate now on Student safety to refresh the assessed counts.'} No personal data is read or written.</p>`, state.classified ? null : 'Apply sample classification', () => {
      state.classified = true; record(`Classified 3,412 sample students using ${sourceLabels[state.source]}`); finish('Sample classification complete. Select Recalculate now here to refresh the age-group counts.');
    });
  }
  function connectionDialog(id) {
    const entry = id === 'canvas' ? ['canvas', 'CA', 'Canvas', 'LMS agent data', 'Teach, Study and Learn, Insights'] : catalogs.find(item => item[0] === id);
    if (!entry) return;
    const custom = id === 'custom';
    openDialog(`Connect ${entry[2]}`, `<p>This simulates admin consent. No sign-in, credentials or network requests are made.</p><h3>Review data access</h3><ul class="change-list">${(custom ? ['Admin-reviewed read-only tools', 'Authorized sample data only'] : ['Courses and curriculum content', 'Assignments, due dates and rubrics', ...(id === 'canvas' ? ['Submission status for Educator Insights'] : [])]).map(text => `<li>${text}</li>`).join('')}</ul>${feeds(entry[4])}${custom ? '<label class="field">Sample HTTPS endpoint<input type="url" id="endpoint" placeholder="https://example.org/mcp" autocomplete="off"></label><p>Use a fictional endpoint only. It is validated locally and never contacted or saved.</p><div id="endpoint-error" class="error" role="alert" hidden></div>' : ''}<div class="callout">Existing user permissions still apply in the concept. LTI installation and agent-data access are separate.</div>`, 'Connect sample data', () => {
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
    recalculate: target => {
      if (recalculating) return;
      const startingRoute = route(), context = target.dataset.recalculateContext;
      const previous = state.ageAssessment.unclassified;
      recalculating = true;
      render(false);
      notify('Recalculating the sample age-group count...');
      recalculateTimer = setTimeout(() => {
        updateAgeAssessment();
        recalculating = false;
        const current = state.ageAssessment.unclassified;
        record(`Recalculated student age groups: ${previous.toLocaleString()} → ${current.toLocaleString()} unclassified (sample data)`);
        finish(previous === current ? `Recalculation complete: ${current.toLocaleString()} unclassified students. No change since the last check.` : `Recalculation complete: ${previous.toLocaleString()} → ${current.toLocaleString()} unclassified students. ${previous - current} fewer students need classification.`);
        if (route() === startingRoute && !dialog.open) (main.querySelector(`[data-recalculate-context="${context}"]`) || main.querySelector('[data-action="recalculate"]'))?.focus({ preventScroll: true });
      }, 700);
    },
    'csv-preview': () => openDialog('Review sample CSV', '<p>Illustrative rows from a fictional 3,412-student import. Validation and upload are simulated, not performed on a real file.</p><pre class="csv-sample">sampleUserId,ageGroup\nsample-001,Minor\nsample-002,Not adult\nsample-003,Minor</pre><div class="callout">Sample validation: required columns present, no duplicate sample identifiers, and recognized age-group values. The full cohort uses fixed illustrative counts.</div>', 'Simulate CSV upload', () => {
      state.csvReady = true; record('Validated sample CSV for manual classification (simulated)'); finish('Sample CSV is ready. You can now preview classification.');
    }),
    classify: classificationDialog,
    audit: () => openDialog('Sample audit log', `<p>Changes made in this browser only. District admin is a fictional account.</p>${auditRows(true)}`, null),
    sds: () => openDialog('School Data Sync: sample sync details', `<p>PowerSchool SIS via OneRoster. ${state.sdsHealthy ? 'No failed records in the latest sample sync.' : '27 student records failed. Review the simulated errors before retrying.'}</p><ul class="change-list">${(state.sdsHealthy ? ['18,940 student records imported', '1,612 educator records imported', '2,860 classes synchronized'] : ['18 records: missing school association', '9 records: duplicate source identifier']).map(text => `<li>${text}</li>`).join('')}</ul>`, state.sdsHealthy ? null : 'Resolve and retry sample records', () => {
      state.sdsHealthy = true; record('Resolved and re-imported 27 sample School Data Sync records'); finish('27 sample records re-imported. Roster readiness is healthy.');
    }),
    lti: () => openDialog('Canvas LTI integration', `<p>Installed in 214 sample courses. Educators can launch Teams meetings, Assignments, OneDrive and Reflect inside Canvas.</p><div class="callout">This does not grant agents access to Canvas. Use Connect Canvas to enable agent data separately.</div>`, null),
    canvas: () => connectionDialog('canvas'),
    'canvas-manage': () => openDialog('Manage Canvas agent data', `<p>Connected to 214 sample classes for Teach, Study and Learn and Educator Insights.</p><div class="callout">Disconnecting agent data does not uninstall the Canvas LTI app.</div>`, 'Disconnect agent data', () => {
      state.canvas = false; record('Disconnected Canvas agent data; LTI remains installed'); finish('Canvas agent data disconnected. LTI is still installed.');
    }),
    'wizard-next': () => { wizard.step = Math.min(4, wizard.step + 1); render(true); },
    'wizard-back': () => { wizard.step = Math.max(0, wizard.step - 1); render(true); },
    'wizard-restart': () => { wizard = makeWizard(); successCount = null; render(true); },
    'wizard-apply': () => {
      const list = changes();
      if (!list.length || (wizard.source === 'csv' && wizard.classify && !state.csvReady)) return;
      state.institution = wizard.institution; state.source = wizard.source;
      state.groups = [...wizard.groups]; state.grades = [...wizard.grades]; state.apps = { ...wizard.apps };
      if (wizard.classify) state.classified = true;
      if (wizard.sync) state.sdsHealthy = true;
      state.canvas = wizard.canvas;
      list.forEach(text => record(`${text} (guided setup)`));
      successCount = list.length; wizard = null;
      finish(`${list.length} sample changes applied.`);
    }
  };
  document.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
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
  document.addEventListener('change', event => {
    const input = event.target;
    const focusId = input.id;
    if (input.dataset.app) {
      const model = input.hasAttribute('data-wizard') ? wizard.apps : state.apps;
      model[input.dataset.app] = input.checked;
      if (!model.study) model.preselect = false;
      if (input.hasAttribute('data-wizard')) render(false);
      else { record(`${input.checked ? 'Turned on' : 'Turned off'} ${apps.find(app => app[0] === input.dataset.app)[1]}${input.dataset.app === 'study' && !input.checked ? '; pre-selection also cleared' : ''}`); finish('Sample app setting saved.'); }
    } else if (input.name === 'institution' || input.name === 'source') {
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
      clearTimeout(recalculateTimer);
      recalculating = false;
      state = defaults(); wizard = null; successCount = null; filter = 'all';
      persist();
      location.hash = 'overview'; render(true); notify(storageProblem || 'Demo reset to the original sample tenant.');
    });
  });
  document.querySelector('#theme').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; finish('Theme updated.'); });
  document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); main.focus(); });
  window.addEventListener('hashchange', () => render(true));
  if (assessmentNeedsSaving && !storageProblem) persist();
  render();
})();
