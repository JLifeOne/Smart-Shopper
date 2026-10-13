(() => {
  'use strict';

  /**
   * Smart Shopper Promos Marketplace — branch-only interaction prototype.
   *
   * Production boundary:
   * This prototype intentionally stores mock state in localStorage. Real authentication,
   * billing, inventory reservation, moderation transitions, ranking, analytics writes,
   * refunds, and entitlements must be enforced by trusted server-side code.
   */

  const STORAGE_KEY = 'smart-shopper-promos-prototype-v2';
  const CATEGORIES = ['For You', 'Grocery', 'Food & Dining', 'Tech', 'Home', 'Auto', 'Events', 'Services'];

  const CAMPAIGNS = [
    {
      id: 'freshmart-weekend', advertiser: 'FreshMart Jamaica', verified: true, category: 'Grocery',
      headline: 'Weekend basket, lighter bill',
      short: 'Save up to 20% on chicken, rice and household essentials through Sunday.',
      detail: 'Selected grocery and household lines are discounted this weekend while stocks last. Prices and availability may vary by location.',
      validity: 'Ends Sunday · 10:00 PM', location: 'Selected Jamaica locations', cta: 'View promo',
      variant: 'variant-a', likes: 486, saves: 311, shares: 92, impressions: 12840, opens: 1920, actions: 174,
      targetingReason: 'This campaign matches grocery categories and items commonly found on active shopping lists.'
    },
    {
      id: 'bytehub-student', advertiser: 'ByteHub', verified: true, category: 'Tech',
      headline: 'Study setup, smarter price',
      short: 'Student-week pricing on keyboards, headphones, chargers and laptop accessories.',
      detail: 'Bring your student ID for selected in-store discounts, or use the campaign link to view eligible online items.',
      validity: 'Valid through Oct 31', location: 'Online + participating stores', cta: 'See tech deals',
      variant: 'variant-b', likes: 213, saves: 188, shares: 71, impressions: 7420, opens: 1038, actions: 132,
      targetingReason: 'You selected Tech as an interest. Recent non-sensitive shopping categories can also improve relevance.'
    },
    {
      id: 'greenhome-refresh', advertiser: 'GreenHome Living', verified: false, category: 'Home',
      headline: 'Refresh your space for less',
      short: 'Storage, organizers and selected kitchen pieces up to 25% off.',
      detail: 'A rotating home-goods promotion featuring organizers, kitchen storage and small household essentials.',
      validity: '7 days remaining', location: 'Islandwide delivery available', cta: 'Explore offer',
      variant: 'variant-c', likes: 145, saves: 206, shares: 38, impressions: 5980, opens: 731, actions: 81,
      targetingReason: 'Shown as a discovery promotion because Smart Shopper preserves some room for adjacent and general offers.'
    },
    {
      id: 'city-food-fest', advertiser: 'City Food Festival', verified: true, category: 'Events',
      headline: 'A weekend built around food',
      short: 'Local chefs, tastings, live demos and family activities. Early-bird tickets are open.',
      detail: 'A food-focused public event with chef demonstrations, local vendors and family activities. Event-specific terms apply.',
      validity: 'Early bird ends Oct 20', location: 'Kingston', cta: 'View event',
      variant: 'variant-d', likes: 329, saves: 270, shares: 164, impressions: 10420, opens: 1672, actions: 241,
      targetingReason: 'This broad event campaign is eligible for users browsing Food & Dining or Events.'
    }
  ];

  const ADVERTISER_CAMPAIGNS = [
    { id: 'adv-001', name: 'Weekend Essentials', status: 'Live', placement: 'Home Spotlight + Feed', dates: 'Oct 10–16', timeSlot: 'All day', spend: 'JMD $8,500', impressions: 12840, likes: 486, saves: 311, shares: 92, cta: 174, engagement: '8.3%' },
    { id: 'adv-002', name: 'Family Value Week', status: 'Scheduled', placement: 'Promos Feed', dates: 'Oct 18–24', timeSlot: '4 PM–10 PM', spend: '7 Promo Days', impressions: 0, likes: 0, saves: 0, shares: 0, cta: 0, engagement: '—' },
    { id: 'adv-003', name: 'Back-to-School Tech', status: 'Completed', placement: 'Home Spotlight', dates: 'Sep 1–7', timeSlot: '2 PM–9 PM', spend: 'JMD $6,000', impressions: 9310, likes: 288, saves: 244, shares: 102, cta: 201, engagement: '9.0%' }
  ];

  const MODERATION = [
    { id: 'mod-1007', campaign: 'Harvest Weekend Sale', advertiser: 'Island Farm Market', payment: 'Paid · JMD $5,500', placement: 'Home Spotlight · 3 days', note: 'Produce promotion; artwork and offer dates supplied.', status: 'Under review' },
    { id: 'mod-1008', campaign: 'Tech Repair Special', advertiser: 'FixPoint Mobile', payment: 'Paid · JMD $3,000', placement: 'Promos Feed · 7 days', note: 'CTA links to WhatsApp. Verify contact and service claim wording.', status: 'Under review' },
    { id: 'mod-1009', campaign: 'Night Event Tickets', advertiser: 'North Coast Events', payment: 'Paid · JMD $7,000', placement: 'Featured evening · 4 days', note: 'Age-sensitive event wording requires policy check before scheduling.', status: 'Under review' }
  ];

  const DEFAULT_STATE = {
    mode: 'shopper', shopperTab: 'home', category: 'For You',
    liked: [], saved: [], hidden: [], reports: [], interests: ['Grocery', 'Tech', 'Food & Dining'],
    advertiserSection: 'overview', advertiserCampaigns: ADVERTISER_CAMPAIGNS,
    campaignStep: 1, packageId: 'feed-7', promoDaysRemaining: 12,
    campaignDraft: {
      name: 'October promotion', category: 'Grocery', headline: 'Save more this weekend',
      description: 'Selected items on promotion while stocks last.', start: '2026-10-16', end: '2026-10-22',
      cta: 'View details', timeSlot: 'All day'
    },
    adminSection: 'review', moderation: MODERATION,
    systemControls: { submissions: true, payments: true, personalization: true, allPromos: true }
  };

  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const modalRoot = document.querySelector('#modal-root');
  let state = loadState();

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored) return cloneDefaultState();
      const base = cloneDefaultState();
      return {
        ...base,
        ...stored,
        campaignDraft: { ...base.campaignDraft, ...(stored.campaignDraft || {}) },
        systemControls: { ...base.systemControls, ...(stored.systemControls || {}) }
      };
    } catch (error) {
      console.warn('promos-prototype: local state could not be loaded; using defaults', error);
      return cloneDefaultState();
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function icon(id) {
    return document.querySelector(`#${id}`)?.innerHTML || '';
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  function render() {
    document.querySelectorAll('.persona-button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === state.mode);
    });
    if (state.mode === 'shopper') renderShopper();
    else if (state.mode === 'advertiser') renderAdvertiser();
    else renderAdmin();
    persist();
  }

  function toggle(list, value) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
  }

  function visibleCampaigns() {
    return CAMPAIGNS.filter((campaign) => !state.hidden.includes(campaign.id));
  }

  function filteredCampaigns() {
    const list = visibleCampaigns();
    if (state.category !== 'For You') return list.filter((campaign) => campaign.category === state.category);
    const interests = new Set(state.interests);
    return [...list].sort((a, b) => {
      const aScore = interests.has(a.category) ? 2 : 0;
      const bScore = interests.has(b.category) ? 2 : 0;
      return bScore - aScore || b.saves - a.saves;
    });
  }

  function actionButton(campaign, type, label) {
    const active = type === 'like' ? state.liked.includes(campaign.id) : type === 'save' ? state.saved.includes(campaign.id) : false;
    const template = type === 'like' ? 'icon-heart' : type === 'save' ? 'icon-bookmark' : 'icon-share';
    return `<button class="icon-action ${active ? 'is-active' : ''}" data-action="${type}" data-id="${campaign.id}" aria-pressed="${active}" aria-label="${escapeHtml(label)} ${escapeHtml(campaign.advertiser)}">${icon(template)}<span>${escapeHtml(label)}</span></button>`;
  }

  function renderSpotlight(campaign) {
    if (!campaign) return '<div class="card card-pad"><strong>No live promotions right now.</strong><p class="helper">The module collapses safely rather than showing expired or broken creative.</p></div>';
    return `
      <section class="promo-spotlight" aria-label="Promoted offer from ${escapeHtml(campaign.advertiser)}">
        <div class="promo-spotlight-inner">
          <div class="promo-meta"><div class="promo-meta-left"><span class="sponsored-label">Promoted</span><span class="advertiser-name">${escapeHtml(campaign.advertiser)}</span>${campaign.verified ? '<span class="verified">✓ Verified</span>' : ''}</div><button class="promo-menu" data-action="promo-menu" data-id="${campaign.id}" aria-label="Promotion options">•••</button></div>
          <div class="promo-copy"><h3>${escapeHtml(campaign.headline)}</h3><p>${escapeHtml(campaign.short)}</p></div>
          <div class="promo-foot"><span class="promo-validity">${escapeHtml(campaign.validity)}</span><div class="action-row">${actionButton(campaign, 'like', 'Like')}${actionButton(campaign, 'save', 'Save')}${actionButton(campaign, 'share', 'Share')}<button class="spotlight-cta" data-action="open-promo" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button></div></div>
        </div>
      </section>`;
  }

  function renderFeedCard(campaign) {
    const likes = campaign.likes + (state.liked.includes(campaign.id) ? 1 : 0);
    const saves = campaign.saves + (state.saved.includes(campaign.id) ? 1 : 0);
    return `
      <article class="feed-card">
        <div class="feed-art ${campaign.variant}"><span class="art-badge">Promoted · ${escapeHtml(campaign.category)}</span><div class="art-copy"><strong>${escapeHtml(campaign.headline)}</strong><span>${escapeHtml(campaign.validity)}</span></div></div>
        <div class="feed-body">
          <div class="feed-topline"><div><strong>${escapeHtml(campaign.advertiser)} ${campaign.verified ? '✓' : ''}</strong><br><small>${escapeHtml(campaign.location)}</small></div><button class="button button-ghost" data-action="promo-menu" data-id="${campaign.id}" aria-label="Promotion options">•••</button></div>
          <p>${escapeHtml(campaign.short)}</p>
          <div class="feed-actions"><div class="feed-actions-left">${actionButton(campaign, 'like', `Like ${likes}`)}${actionButton(campaign, 'save', `Save ${saves}`)}${actionButton(campaign, 'share', 'Share')}</div><button class="feed-cta" data-action="open-promo" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button></div>
        </div>
      </article>`;
  }

  function renderShopper() {
    app.innerHTML = `
      <div class="page-stack">
        <div class="page-heading"><div><span class="eyebrow">Shopper preview</span><h1>Useful promotions, not random banners.</h1><p>Test Home Spotlight, discovery, Like, Save, Share, explainability and advertiser entry before production integration.</p></div><div class="page-heading-actions"><button class="button button-secondary" data-action="manage-interests">Interests</button><button class="button button-primary" data-action="switch-mode" data-mode="advertiser">Advertise</button></div></div>
        <div class="mobile-frame"><div class="mobile-status"></div><div class="mobile-content"><div class="mobile-topbar"><strong>Smart Shopper</strong><span class="avatar">JL</span></div>${renderShopperScreen()}<nav class="mobile-nav" aria-label="Shopper preview navigation">${['home','promos','saved','interests'].map((tab) => `<button class="${state.shopperTab === tab ? 'is-active' : ''}" data-action="shopper-tab" data-tab="${tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}</nav></div></div>
      </div>`;
  }

  function renderShopperScreen() {
    if (state.shopperTab === 'home') {
      return `<div class="home-intro"><h2>Good morning</h2><p>Your shopping intelligence and useful offers in one place.</p></div>${renderSpotlight(visibleCampaigns()[0])}<div class="mini-grid"><div class="mini-card"><strong>${state.saved.length}</strong><span>Saved promos</span></div><div class="mini-card"><strong>${state.interests.length}</strong><span>Interests</span></div><div class="mini-card"><strong>2</strong><span>List matches</span></div></div><div class="promo-feed"><div class="inline-note">Example: if an active list contains chicken and detergent, relevant campaigns can rank higher without giving the advertiser access to the user's actual list.</div><button class="button button-secondary" data-action="shopper-tab" data-tab="promos">Browse all promos</button></div>`;
    }
    if (state.shopperTab === 'promos') {
      const campaigns = filteredCampaigns();
      return `<div class="home-intro"><span class="eyebrow">Promos</span><h2>Offers picked for you</h2><p>Browse directly by category or use the For You ranking.</p></div><div class="promo-feed"><div class="category-strip">${CATEGORIES.map((category) => `<button class="category-chip ${state.category === category ? 'is-active' : ''}" data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}</div>${campaigns.length ? campaigns.map(renderFeedCard).join('') : '<div class="inline-note">No live promotions in this category. Smart Shopper should not fill the space with irrelevant inventory.</div>'}<button class="button button-accent" data-action="switch-mode" data-mode="advertiser">Advertise on Smart Shopper</button></div>`;
    }
    if (state.shopperTab === 'saved') {
      const campaigns = CAMPAIGNS.filter((campaign) => state.saved.includes(campaign.id) && !state.hidden.includes(campaign.id));
      return `<div class="home-intro"><span class="eyebrow">Saved</span><h2>Your saved promos</h2><p>Saved offers can later support optional expiry reminders.</p></div><div class="promo-feed">${campaigns.length ? campaigns.map(renderFeedCard).join('') : '<div class="inline-note">Nothing saved yet. Tap the bookmark glyph on a promotion.</div>'}</div>`;
    }
    return `<div class="home-intro"><span class="eyebrow">Control</span><h2>Your interests</h2><p>Explicit interests help personalization without reducing a person to one identity.</p></div><div class="promo-feed"><div class="category-strip" style="flex-wrap:wrap;overflow:visible">${CATEGORIES.filter((category) => category !== 'For You').map((category) => `<button class="category-chip ${state.interests.includes(category) ? 'is-active' : ''}" data-action="interest" data-category="${escapeHtml(category)}" aria-pressed="${state.interests.includes(category)}">${escapeHtml(category)}</button>`).join('')}</div><div class="inline-note">Sensitive traits are excluded from inference-based ad targeting. Users can explicitly manage ordinary content interests.</div></div>`;
  }

  function openPromo(id) {
    const campaign = CAMPAIGNS.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop><article class="modal-card" role="dialog" aria-modal="true" aria-labelledby="promo-detail-title"><div class="modal-header"><div><span class="eyebrow">Promoted</span><h3 id="promo-detail-title">${escapeHtml(campaign.advertiser)} ${campaign.verified ? '✓' : ''}</h3><p>${escapeHtml(campaign.location)}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div><div class="detail-creative"><strong>${escapeHtml(campaign.headline)}</strong><span>${escapeHtml(campaign.short)}</span></div><div class="detail-info"><p style="margin:0;color:var(--secondary);font-size:12px;line-height:1.6">${escapeHtml(campaign.detail)}</p><div class="detail-row"><span>Valid</span><strong>${escapeHtml(campaign.validity)}</strong></div><div class="detail-row"><span>Category</span><strong>${escapeHtml(campaign.category)}</strong></div><div class="detail-row"><span>Location</span><strong>${escapeHtml(campaign.location)}</strong></div></div><div class="modal-actions">${actionButton(campaign, 'like', 'Like')}${actionButton(campaign, 'save', 'Save')}${actionButton(campaign, 'share', 'Share')}<button class="button button-primary" data-action="cta" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button></div></article></div>`;
  }

  function openPromoMenu(id) {
    const campaign = CAMPAIGNS.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop><div class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div><h3>Promotion options</h3><p>${escapeHtml(campaign.advertiser)}</p></div><button class="modal-close" data-action="close-modal">×</button></div><div style="display:grid;gap:8px;margin-top:14px"><button class="button button-secondary" data-action="why-promo" data-id="${campaign.id}">Why am I seeing this?</button><button class="button button-secondary" data-action="not-interested" data-id="${campaign.id}">Not interested</button><button class="button button-secondary" data-action="hide" data-id="${campaign.id}">Hide this promotion</button><button class="button button-danger" data-action="report" data-id="${campaign.id}">Report ad</button></div></div></div>`;
  }

  function openWhy(id) {
    const campaign = CAMPAIGNS.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-backdrop><div class="modal-card" role="dialog" aria-modal="true"><div class="modal-header"><div><h3>Why you're seeing this</h3><p>Explanations stay high-level and exclude sensitive traits.</p></div><button class="modal-close" data-action="close-modal">×</button></div><div class="inline-note" style="margin-top:14px">${escapeHtml(campaign.targetingReason)}</div><div class="modal-actions"><button class="button button-secondary" data-action="manage-interests">Manage interests</button></div></div></div>`;
  }

  async function shareCampaign(id) {
    const campaign = CAMPAIGNS.find((item) => item.id === id);
    if (!campaign) return;
    const payload = { title: `${campaign.advertiser} · ${campaign.headline}`, text: campaign.short, url: `${location.href.split('#')[0]}#promo=${encodeURIComponent(campaign.id)}` };
    try {
      if (navigator.share) await navigator.share(payload);
      else if (navigator.clipboard) { await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`); showToast('Promo link copied.'); }
      else showToast('Sharing is unavailable in this browser.');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing was not available.');
    }
  }

  function statusClass(status) {
    if (status === 'Live' || status === 'Approved') return 'status-live';
    if (status === 'Scheduled') return 'status-scheduled';
    if (status === 'Changes requested') return 'status-change';
    if (status === 'Rejected') return 'status-rejected';
    return 'status-review';
  }

  function renderAdvertiser() {
    const tabs = ['overview', 'campaigns', 'create', 'analytics', 'credits'];
    app.innerHTML = `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">Advertiser workspace</span><h1>Make reach understandable and improvable.</h1><p>Campaign creation, reusable campaigns, Promo Days, analytics and optimization guidance live in one workspace.</p></div><div class="page-heading-actions"><button class="button button-secondary" data-action="reset">Reset preview</button><button class="button button-primary" data-action="advertiser-section" data-section="create">Create campaign</button></div></div><div class="category-strip">${tabs.map((tab) => `<button class="category-chip ${state.advertiserSection === tab ? 'is-active' : ''}" data-action="advertiser-section" data-section="${tab}">${tab === 'create' ? 'Create Campaign' : tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}</div>${renderAdvertiserSection()}</div>`;
  }

  function renderAdvertiserSection() {
    if (state.advertiserSection === 'campaigns') return renderCampaignTable();
    if (state.advertiserSection === 'create') return renderCampaignBuilder();
    if (state.advertiserSection === 'analytics') return renderAnalytics();
    if (state.advertiserSection === 'credits') return renderCredits();
    const live = state.advertiserCampaigns.find((campaign) => campaign.status === 'Live') || state.advertiserCampaigns[0];
    return `<div class="dashboard-grid"><section class="panel"><div class="section-title"><div><h2>Overview</h2><p>Current account and campaign health.</p></div><span class="status-pill status-live">Premium Pro</span></div><div class="kpi-grid" style="margin-top:14px"><div class="kpi"><strong>1</strong><span>Live campaigns</span><small>1 scheduled next</small></div><div class="kpi"><strong>12.8k</strong><span>Current reach</span><small>+18% vs prior</small></div><div class="kpi"><strong>311</strong><span>Saves</span><small>Strong intent signal</small></div><div class="kpi"><strong>${state.promoDaysRemaining}</strong><span>Promo Days left</span><small>Renews Nov 1</small></div></div></section><section class="panel two-thirds"><div class="section-title"><div><h3>${escapeHtml(live.name)}</h3><p>Reach → Interest → Intent → Action</p></div><button class="button button-secondary" data-action="advertiser-section" data-section="analytics">Full analytics</button></div>${renderFunnel(live)}</section><section class="panel third"><div class="section-title"><h3>Optimization assistant</h3></div><div class="recommendation-card" style="margin-top:12px"><div class="recommendation-icon">↗</div><div><strong>Keep the evening window</strong><p>Your completed tech campaign performed better from 4–9 PM. Consider that window when inventory is available.</p></div></div><div class="recommendation-card" style="margin-top:9px"><div class="recommendation-icon">★</div><div><strong>Saves are healthy</strong><p>Test a clearer CTA before changing targeting. Saved intent is already strong.</p></div></div></section></div>`;
  }

  function renderFunnel(campaign) {
    return `<div class="metric-funnel"><div class="funnel-step"><b>${Number(campaign.impressions || 0).toLocaleString()}</b><span>Impressions</span></div><div class="funnel-step"><b>${campaign.likes || 0}</b><span>Likes</span></div><div class="funnel-step"><b>${campaign.saves || 0}</b><span>Saves</span></div><div class="funnel-step"><b>${campaign.shares || 0}</b><span>Shares</span></div><div class="funnel-step"><b>${campaign.cta || 0}</b><span>CTA actions</span></div></div>`;
  }

  function renderCampaignTable() {
    return `<section class="panel"><div class="section-title"><div><h2>Campaigns</h2><p>Reuse creates a new draft; historical analytics stay with the original.</p></div></div><div style="overflow:auto"><table class="data-table"><thead><tr><th>Campaign</th><th>Status</th><th>Placement</th><th>Dates</th><th>Engagement</th><th>Action</th></tr></thead><tbody>${state.advertiserCampaigns.map((campaign) => `<tr><td><strong>${escapeHtml(campaign.name)}</strong><br><small>${escapeHtml(campaign.timeSlot)}</small></td><td><span class="status-pill ${statusClass(campaign.status)}">${escapeHtml(campaign.status)}</span></td><td>${escapeHtml(campaign.placement)}</td><td>${escapeHtml(campaign.dates)}</td><td>${escapeHtml(campaign.engagement)}</td><td><button class="button button-secondary" data-action="reuse-campaign" data-id="${campaign.id}">Reuse</button></td></tr>`).join('')}</tbody></table></div></section>`;
  }

  function builderNav(step, final = false) {
    return `<div class="modal-actions">${step > 1 ? `<button class="button button-secondary" data-action="campaign-step" data-step="${step - 1}">Back</button>` : ''}${!final && step < 8 ? `<button class="button button-primary" data-action="campaign-step" data-step="${step + 1}">Continue</button>` : ''}</div>`;
  }

  function renderCampaignBuilder() {
    const steps = [[1,'Basics'],[2,'Creative'],[3,'Action'],[4,'Audience'],[5,'Placement'],[6,'Price'],[7,'Preview'],[8,'Pay & submit']];
    return `<div class="form-layout"><aside class="step-list">${steps.map(([number,label]) => `<button class="step-button ${state.campaignStep === number ? 'is-active' : ''}" data-action="campaign-step" data-step="${number}">${number}. ${label}</button>`).join('')}</aside><section class="form-card">${renderCampaignStep(state.campaignStep)}</section></div>`;
  }

  function renderCampaignStep(step) {
    const draft = state.campaignDraft;
    if (step === 1) return `<div class="section-title"><div><h2>Campaign basics</h2><p>Define the offer before targeting or payment.</p></div></div><div class="form-grid" style="margin-top:14px"><div class="field full"><label>Internal campaign name</label><input data-field="name" value="${escapeHtml(draft.name)}"></div><div class="field"><label>Category</label><select data-field="category">${CATEGORIES.filter((category) => category !== 'For You').map((category) => `<option ${draft.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}</select></div><div class="field"><label>Headline</label><input data-field="headline" value="${escapeHtml(draft.headline)}"></div><div class="field full"><label>Description</label><textarea data-field="description">${escapeHtml(draft.description)}</textarea></div><div class="field"><label>Start</label><input type="date" data-field="start" value="${escapeHtml(draft.start)}"></div><div class="field"><label>End</label><input type="date" data-field="end" value="${escapeHtml(draft.end)}"></div></div>${builderNav(step)}`;
    if (step === 2) return `<div class="section-title"><div><h2>Creative</h2><p>Artwork is optional. Smart Shopper can create a structured fallback.</p></div></div><div class="detail-creative"><strong>${escapeHtml(draft.headline)}</strong><span>${escapeHtml(draft.description)}</span></div><div class="inline-note" style="margin-top:12px">Prototype: image upload is not connected. Production must validate file type, crop safe areas, alt text and policy.</div>${builderNav(step)}`;
    if (step === 3) return `<div class="section-title"><div><h2>Action</h2><p>Choose what the shopper should do next.</p></div></div><div class="form-grid" style="margin-top:14px"><div class="field full"><label>Primary CTA</label><select data-field="cta">${['View details','Claim offer','WhatsApp','Call','Website','Directions','Register','Book','Buy ticket'].map((value) => `<option ${draft.cta === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div>${builderNav(step)}`;
    if (step === 4) return `<div class="section-title"><div><h2>Audience & relevance</h2><p>The advertiser supplies campaign context; Smart Shopper matches internally.</p></div></div><div class="inline-note" style="margin-top:12px">Selected category: <strong>${escapeHtml(draft.category)}</strong>. Production will add product/topic tags, broad geography and contextual/list matching without exposing shopper identities.</div><div class="warning-note inline-note" style="margin-top:9px">Sensitive traits are excluded from inference-based targeting.</div>${builderNav(step)}`;
    if (step === 5) return `<div class="section-title"><div><h2>Placement & inventory</h2><p>Time slots and featured inventory are real capacity constraints.</p></div></div><div class="package-grid" style="margin-top:14px">${[['feed-7','Promos Feed · 7 days','JMD $3,500'],['home-3','Home Spotlight · 3 days','JMD $6,000'],['evening-4','Featured evening · 4 days','JMD $8,500']].map(([id,label,price]) => `<div class="package-card ${state.packageId === id ? 'is-selected' : ''}" data-action="package" data-package="${id}"><strong>${label}</strong><span>${price} · prototype pricing only</span></div>`).join('')}</div>${builderNav(step)}`;
    const price = calculatePrice();
    if (step === 6) return `<div class="section-title"><div><h2>Entitlements & price</h2><p>Premium benefits reduce what is due; non-Premium advertisers can still buy directly.</p></div></div>${priceSummary(price)}${builderNav(step)}`;
    if (step === 7) return `<div class="section-title"><div><h2>Final preview</h2><p>Review shopper-facing content before payment and moderation.</p></div></div><div class="detail-creative"><strong>${escapeHtml(draft.headline)}</strong><span>${escapeHtml(draft.description)}</span></div><div class="checkout-summary"><div class="checkout-row"><span>Category</span><strong>${escapeHtml(draft.category)}</strong></div><div class="checkout-row"><span>CTA</span><strong>${escapeHtml(draft.cta)}</strong></div><div class="checkout-row"><span>Dates</span><strong>${escapeHtml(draft.start)} → ${escapeHtml(draft.end)}</strong></div></div><label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:11px;color:var(--secondary)"><input type="checkbox" checked><span>I confirm this promotion follows Smart Shopper advertising policy. Payment submits it for review.</span></label>${builderNav(step)}`;
    return `<div class="section-title"><div><h2>Pay & submit</h2><p>Payment and submission happen in one transaction.</p></div></div>${priceSummary(price)}<div class="inline-note" style="margin-top:12px">Prototype only: this button simulates payment and submission. No financial details are collected.</div><button class="button button-primary" style="width:100%;margin-top:14px" data-action="submit-campaign">Simulate payment & submit</button>${builderNav(step, true)}`;
  }

  function calculatePrice() {
    const packages = {
      'feed-7': { label: 'Promos Feed · 7 days', gross: 3500, days: 7 },
      'home-3': { label: 'Home Spotlight · 3 days', gross: 6000, days: 3 },
      'evening-4': { label: 'Featured evening · 4 days', gross: 8500, days: 4 }
    };
    const selected = packages[state.packageId] || packages['feed-7'];
    const coveredDays = Math.min(state.promoDaysRemaining, selected.days);
    const dailyValue = Math.round(selected.gross / selected.days);
    const credit = Math.min(selected.gross, coveredDays * dailyValue);
    const due = Math.max(0, selected.gross - credit);
    return { ...selected, coveredDays, credit, due };
  }

  function money(value) {
    return `JMD $${Number(value).toLocaleString()}`;
  }

  function priceSummary(price) {
    return `<div class="checkout-summary"><div class="checkout-row"><span>Selected campaign</span><strong>${escapeHtml(price.label)}</strong></div><div class="checkout-row"><span>Gross price</span><strong>${money(price.gross)}</strong></div><div class="checkout-row"><span>Premium benefit</span><strong>-${money(price.credit)}</strong></div><div class="checkout-row"><span>Promo Days remaining</span><strong>${state.promoDaysRemaining}</strong></div><div class="checkout-row total"><span>Due today</span><strong>${money(price.due)}</strong></div></div>`;
  }

  function submitCampaign() {
    const price = calculatePrice();
    state.promoDaysRemaining -= price.coveredDays;
    state.advertiserCampaigns.unshift({
      id: `adv-${Date.now()}`, name: state.campaignDraft.name || 'Untitled campaign', status: 'Under review',
      placement: price.label.split(' · ')[0], dates: `${state.campaignDraft.start}–${state.campaignDraft.end}`,
      timeSlot: state.campaignDraft.timeSlot, spend: price.due ? money(price.due) : `${price.coveredDays} Promo Days`,
      impressions: 0, likes: 0, saves: 0, shares: 0, cta: 0, engagement: '—'
    });
    state.advertiserSection = 'campaigns';
    state.campaignStep = 1;
    render();
    showToast('Payment simulated. Campaign is Paid · Under Review.');
  }

  function reuseCampaign(id) {
    const source = state.advertiserCampaigns.find((campaign) => campaign.id === id);
    if (!source) return;
    state.campaignDraft.name = `${source.name} · Copy`;
    state.advertiserSection = 'create';
    state.campaignStep = 1;
    render();
    showToast('Campaign copied to a new draft. Dates, offer and inventory must be rechecked.');
  }

  function renderAnalytics() {
    const campaign = state.advertiserCampaigns[0];
    return `<div class="dashboard-grid"><section class="panel"><div class="section-title"><div><h2>${escapeHtml(campaign.name)}</h2><p>Privacy-preserving aggregated funnel analytics.</p></div></div>${renderFunnel(campaign)}</section><section class="panel half"><div class="section-title"><h3>Interpretation</h3></div><div class="recommendation-card" style="margin-top:12px"><div class="recommendation-icon">i</div><div><strong>Saves are stronger than CTA clicks</strong><p>Test clearer urgency or CTA wording before changing targeting.</p></div></div></section><section class="panel half"><div class="section-title"><h3>Privacy boundary</h3></div><div class="inline-note" style="margin-top:12px">The advertiser sees aggregated results, not who saved an ad, a private shopping list, or an individual shopper's interest profile.</div></section></div>`;
  }

  function renderCredits() {
    return `<section class="panel"><div class="section-title"><div><h2>Promo Days & credits</h2><p>Entitlements are a ledger, not a simple Premium=true flag.</p></div></div><div class="kpi-grid" style="margin-top:14px"><div class="kpi"><strong>${state.promoDaysRemaining}</strong><span>Days remaining</span><small>Premium Pro</small></div><div class="kpi"><strong>20</strong><span>Days granted</span><small>Current cycle</small></div><div class="kpi"><strong>${20-state.promoDaysRemaining}</strong><span>Days consumed</span><small>Prototype ledger</small></div><div class="kpi"><strong>Nov 1</strong><span>Renews</span><small>Unused policy TBD</small></div></div><div class="inline-note" style="margin-top:14px">Production records grants, consumption, expiry and restoration so support can explain every balance change.</div></section>`;
  }

  function renderAdmin() {
    const tabs = ['review', 'inventory', 'controls', 'support'];
    app.innerHTML = `<div class="page-stack"><div class="page-heading"><div><span class="eyebrow">Admin operations preview</span><h1>Moderation, money, inventory and safety in one operating surface.</h1><p>Production access must be role-based and server-enforced.</p></div><div class="page-heading-actions"><button class="button button-secondary" data-action="reset">Reset preview</button></div></div><div class="category-strip">${tabs.map((tab) => `<button class="category-chip ${state.adminSection === tab ? 'is-active' : ''}" data-action="admin-section" data-section="${tab}">${tab[0].toUpperCase()+tab.slice(1)}</button>`).join('')}</div>${renderAdminSection()}</div>`;
  }

  function renderAdminSection() {
    if (state.adminSection === 'inventory') return renderInventory();
    if (state.adminSection === 'controls') return renderControls();
    if (state.adminSection === 'support') return renderSupport();
    const pending = state.moderation.filter((item) => item.status === 'Under review');
    return `<div class="dashboard-grid"><section class="panel two-thirds"><div class="section-title"><div><h2>Review Queue</h2><p>Paid submissions remain reserved while moderation is completed.</p></div><span class="status-pill status-review">${pending.length} pending</span></div><div style="margin-top:13px">${state.moderation.map((item) => `<article class="queue-card"><div><span class="status-pill ${statusClass(item.status)}">${escapeHtml(item.status)}</span><h4 style="margin-top:8px">${escapeHtml(item.campaign)}</h4><p><strong>${escapeHtml(item.advertiser)}</strong> · ${escapeHtml(item.payment)}<br>${escapeHtml(item.placement)}<br>${escapeHtml(item.note)}</p></div><div class="queue-actions"><button class="button button-secondary" data-action="moderation" data-id="${item.id}" data-status="Changes requested">Request changes</button><button class="button button-primary" data-action="moderation" data-id="${item.id}" data-status="Approved">Approve</button><button class="button button-danger" data-action="moderation" data-id="${item.id}" data-status="Rejected">Reject + refund</button></div></article>`).join('')}</div></section><section class="panel third"><div class="section-title"><h3>Queue health</h3></div><div class="kpi" style="margin-top:12px"><strong>${pending.length}</strong><span>Awaiting review</span><small>Target SLA not yet set</small></div><div class="inline-note" style="margin-top:10px">Automated safety checks may prioritize work, but human moderation authority remains explicit.</div></section></div>`;
  }

  function renderInventory() {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return `<section class="panel"><div class="section-title"><div><h2>Home Spotlight inventory</h2><p>Paid-under-review reservations count against capacity so slots are not double-sold.</p></div></div><div class="inventory-grid">${days.map((day,index) => `<div class="inventory-cell ${index === 4 || index === 5 ? 'is-heavy' : 'is-open'}"><strong>${day}</strong><span>${index === 4 || index === 5 ? 'Evening nearly full' : 'Capacity available'}</span><span>${index === 5 ? '2 paid under review' : '1 scheduled'}</span></div>`).join('')}</div><div class="warning-note inline-note" style="margin-top:12px">Production reservation must be transactional and idempotent. Successful payment cannot result in overselling exclusive inventory.</div></section>`;
  }

  function renderControls() {
    const controls = [
      ['allPromos','Promos delivery','Emergency pause all served promos.'],
      ['submissions','Campaign submissions','Allow advertisers to submit new campaigns.'],
      ['payments','New payments','Allow campaign checkout/payment attempts.'],
      ['personalization','Personalized ranking','Disable personalized ranking while preserving safe contextual/broad delivery.']
    ];
    return `<section class="panel"><div class="section-title"><div><h2>System controls</h2><p>Emergency actions are explicit, auditable and reversible.</p></div></div><div class="admin-controls" style="margin-top:14px">${controls.map(([key,label,description]) => `<div class="control-card"><strong>${label}</strong><p>${description}</p><button class="toggle ${state.systemControls[key] ? 'is-on' : ''}" data-action="control" data-control="${key}" aria-pressed="${state.systemControls[key]}"></button></div>`).join('')}</div><div class="danger-note inline-note" style="margin-top:12px">Production toggles require strong authorization, reason capture and append-only audit events. They must never be client-only security controls.</div></section>`;
  }

  function renderSupport() {
    return `<div class="dashboard-grid"><section class="panel half"><div class="section-title"><h2>Advertiser support profile</h2></div><div style="display:grid;gap:10px;margin-top:12px"><div><strong>FreshMart Jamaica</strong><br><small>Verified advertiser · 6 campaigns</small></div><div class="inline-note">Support should see payments, entitlement ledger, moderation history, refunds, warnings and authored notes without automatically receiving super-admin power.</div></div></section><section class="panel half"><div class="section-title"><h2>Audit expectation</h2></div><div class="inline-note" style="margin-top:12px">Every moderation, refund, credit, emergency-control and restriction action records actor, timestamp, reason, previous state and resulting state.</div></section></div>`;
  }

  function moderate(id, status) {
    const item = state.moderation.find((entry) => entry.id === id);
    if (!item) return;
    item.status = status;
    render();
    if (status === 'Rejected') showToast('Prototype: rejected; refund/restoration queued.');
    else if (status === 'Changes requested') showToast('Changes requested. Payment and reservation remain intact.');
    else showToast('Approved. Campaign can proceed to scheduling.');
  }

  function resetPrototype() {
    state = cloneDefaultState();
    localStorage.removeItem(STORAGE_KEY);
    closeModal();
    render();
    showToast('Prototype state reset.');
  }

  document.addEventListener('click', (event) => {
    // Backdrop dismissal is intentionally exact-match so clicks inside a dialog never close it accidentally.
    if (event.target.matches('[data-backdrop]')) {
      closeModal();
      return;
    }

    const target = event.target.closest('[data-action], .persona-button');
    if (!target) return;

    if (target.matches('.persona-button')) {
      state.mode = target.dataset.mode;
      closeModal();
      render();
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;
    const clickedInsidePromoModal = Boolean(target.closest('.modal-card'));

    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'switch-mode') { state.mode = target.dataset.mode; closeModal(); render(); return; }
    if (action === 'go-shopper') { state.mode = 'shopper'; state.shopperTab = 'home'; closeModal(); render(); return; }
    if (action === 'shopper-tab') { state.shopperTab = target.dataset.tab; render(); return; }
    if (action === 'category') { state.category = target.dataset.category; render(); return; }
    if (action === 'interest') { toggle(state.interests, target.dataset.category); render(); return; }
    if (action === 'manage-interests') { state.mode = 'shopper'; state.shopperTab = 'interests'; closeModal(); render(); return; }
    if (action === 'like') { toggle(state.liked, id); render(); if (clickedInsidePromoModal) openPromo(id); return; }
    if (action === 'save') { toggle(state.saved, id); render(); if (clickedInsidePromoModal) openPromo(id); return; }
    if (action === 'share') { void shareCampaign(id); return; }
    if (action === 'open-promo') { openPromo(id); return; }
    if (action === 'promo-menu') { openPromoMenu(id); return; }
    if (action === 'why-promo') { openWhy(id); return; }
    if (action === 'not-interested') { if (!state.hidden.includes(id)) state.hidden.push(id); closeModal(); render(); showToast('We will show fewer promotions like this.'); return; }
    if (action === 'hide') { if (!state.hidden.includes(id)) state.hidden.push(id); closeModal(); render(); showToast('Promotion hidden.'); return; }
    if (action === 'report') { if (!state.reports.includes(id)) state.reports.push(id); closeModal(); persist(); showToast('Report recorded in this prototype.'); return; }
    if (action === 'cta') { showToast('CTA recorded. Production can stay in-app or open an approved external destination.'); return; }
    if (action === 'advertiser-section') { state.advertiserSection = target.dataset.section; render(); return; }
    if (action === 'campaign-step') { state.campaignStep = Number(target.dataset.step); render(); return; }
    if (action === 'package') { state.packageId = target.dataset.package; render(); return; }
    if (action === 'submit-campaign') { submitCampaign(); return; }
    if (action === 'reuse-campaign') { reuseCampaign(id); return; }
    if (action === 'admin-section') { state.adminSection = target.dataset.section; render(); return; }
    if (action === 'moderation') { moderate(id, target.dataset.status); return; }
    if (action === 'control') { const key = target.dataset.control; state.systemControls[key] = !state.systemControls[key]; render(); showToast(`${key} ${state.systemControls[key] ? 'enabled' : 'paused'} in prototype.`); return; }
    if (action === 'reset') resetPrototype();
  });

  document.addEventListener('input', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    state.campaignDraft[field] = event.target.value;
    persist();
  });

  document.addEventListener('change', (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    state.campaignDraft[field] = event.target.value;
    persist();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('promos-prototype: service worker registration failed', error));
  }

  render();
})();
