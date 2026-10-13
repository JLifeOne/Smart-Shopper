(() => {
  'use strict';

  /**
   * Branch-only Promos Marketplace prototype.
   *
   * Important architectural boundary:
   * - This file intentionally uses browser-local mock state.
   * - It does not authenticate admins, process payments, or target real users.
   * - Production equivalents must move authorization, billing, inventory reservation,
   *   moderation state transitions, and analytics writes to trusted server-side code.
   */

  const STORAGE_KEY = 'smart-shopper-promos-prototype-v1';

  const categories = ['For You', 'Grocery', 'Food & Dining', 'Tech', 'Home', 'Auto', 'Events', 'Services'];

  const seedCampaigns = [
    {
      id: 'cmp_freshmart_weekend',
      advertiser: 'FreshMart Jamaica',
      verified: true,
      category: 'Grocery',
      headline: 'Weekend basket, lighter bill',
      short: 'Save up to 20% on chicken, rice and household essentials through Sunday.',
      detail: 'Selected grocery and household lines are discounted this weekend while stocks last. Prices and availability may vary by location.',
      validity: 'Ends Sunday · 10:00 PM',
      location: 'Selected Jamaica locations',
      cta: 'View promo',
      variant: 'variant-a',
      tags: ['chicken', 'rice', 'detergent', 'grocery'],
      targetingReason: 'This campaign matches grocery categories and items commonly found on active shopping lists.',
      likes: 486,
      saves: 311,
      shares: 92,
      impressions: 12840,
      opens: 1920,
      actions: 174,
      status: 'live'
    },
    {
      id: 'cmp_bytehub_student',
      advertiser: 'ByteHub',
      verified: true,
      category: 'Tech',
      headline: 'Study setup, smarter price',
      short: 'Student-week pricing on keyboards, headphones, chargers and laptop accessories.',
      detail: 'Bring your student ID for selected in-store discounts, or use the campaign link to view eligible online items.',
      validity: 'Valid through Oct 31',
      location: 'Online + participating stores',
      cta: 'See tech deals',
      variant: 'variant-b',
      tags: ['college', 'laptop', 'headphones', 'tech'],
      targetingReason: 'You selected Tech as an interest. Smart Shopper also uses recent non-sensitive shopping categories to improve relevance.',
      likes: 213,
      saves: 188,
      shares: 71,
      impressions: 7420,
      opens: 1038,
      actions: 132,
      status: 'live'
    },
    {
      id: 'cmp_greenhome_refresh',
      advertiser: 'GreenHome Living',
      verified: false,
      category: 'Home',
      headline: 'Refresh your space for less',
      short: 'Storage, organizers and selected kitchen pieces up to 25% off.',
      detail: 'A rotating home-goods promotion featuring organizers, kitchen storage and small household essentials.',
      validity: '7 days remaining',
      location: 'Islandwide delivery available',
      cta: 'Explore offer',
      variant: 'variant-c',
      tags: ['home', 'storage', 'kitchen'],
      targetingReason: 'Shown as a discovery promotion because Smart Shopper reserves a small amount of space for adjacent and general offers.',
      likes: 145,
      saves: 206,
      shares: 38,
      impressions: 5980,
      opens: 731,
      actions: 81,
      status: 'live'
    },
    {
      id: 'cmp_cityfood_fest',
      advertiser: 'City Food Festival',
      verified: true,
      category: 'Events',
      headline: 'A weekend built around food',
      short: 'Local chefs, tastings, live demos and family activities. Early-bird tickets are open.',
      detail: 'A food-focused public event with chef demonstrations, local vendors and family activities. Event-specific terms apply.',
      validity: 'Early bird ends Oct 20',
      location: 'Kingston',
      cta: 'View event',
      variant: 'variant-d',
      tags: ['food', 'event', 'chef', 'family'],
      targetingReason: 'This is a broad event campaign eligible for users browsing Food & Dining or Events.',
      likes: 329,
      saves: 270,
      shares: 164,
      impressions: 10420,
      opens: 1672,
      actions: 241,
      status: 'live'
    }
  ];

  const seedAdvertiserCampaigns = [
    {
      id: 'adv_cmp_001',
      name: 'Weekend Essentials',
      status: 'Live',
      placement: 'Home Spotlight + Feed',
      dates: 'Oct 10–16',
      timeSlot: 'All day',
      spend: 'JMD $8,500',
      impressions: 12840,
      likes: 486,
      saves: 311,
      shares: 92,
      cta: 174,
      engagement: '8.3%'
    },
    {
      id: 'adv_cmp_002',
      name: 'Family Value Week',
      status: 'Scheduled',
      placement: 'Promos Feed',
      dates: 'Oct 18–24',
      timeSlot: '4 PM–10 PM',
      spend: '7 Promo Days',
      impressions: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      cta: 0,
      engagement: '—'
    },
    {
      id: 'adv_cmp_003',
      name: 'Back-to-School Tech',
      status: 'Completed',
      placement: 'Home Spotlight',
      dates: 'Sep 1–7',
      timeSlot: '2 PM–9 PM',
      spend: 'JMD $6,000',
      impressions: 9310,
      likes: 288,
      saves: 244,
      shares: 102,
      cta: 201,
      engagement: '9.0%'
    }
  ];

  const seedModeration = [
    {
      id: 'mod_1007',
      campaign: 'Harvest Weekend Sale',
      advertiser: 'Island Farm Market',
      payment: 'Paid · JMD $5,500',
      placement: 'Home Spotlight · 3 days',
      risk: 'Low',
      note: 'Produce promotion; artwork and offer dates supplied.',
      status: 'Under review'
    },
    {
      id: 'mod_1008',
      campaign: 'Tech Repair Special',
      advertiser: 'FixPoint Mobile',
      payment: 'Paid · JMD $3,000',
      placement: 'Promos Feed · 7 days',
      risk: 'Low',
      note: 'CTA links to WhatsApp. Verify contact and service claim wording.',
      status: 'Under review'
    },
    {
      id: 'mod_1009',
      campaign: 'Night Event Tickets',
      advertiser: 'North Coast Events',
      payment: 'Paid · JMD $7,000',
      placement: 'Featured evening · 4 days',
      risk: 'Review',
      note: 'Age-sensitive event wording requires policy check before scheduling.',
      status: 'Under review'
    }
  ];

  const defaultState = {
    mode: 'shopper',
    shopperTab: 'home',
    category: 'For You',
    liked: [],
    saved: [],
    hidden: [],
    reports: [],
    interests: ['Grocery', 'Tech', 'Food & Dining'],
    advertiserCampaigns: seedAdvertiserCampaigns,
    moderation: seedModeration,
    advertiserSection: 'overview',
    adminSection: 'review',
    campaignStep: 1,
    packageId: 'feed-7',
    campaignDraft: {
      name: 'October promotion',
      category: 'Grocery',
      headline: 'Save more this weekend',
      description: 'Selected items on promotion while stocks last.',
      start: '2026-10-16',
      end: '2026-10-22',
      cta: 'View details',
      placement: 'Promos Feed',
      timeSlot: 'All day'
    },
    promoDaysRemaining: 12,
    systemControls: {
      submissions: true,
      payments: true,
      personalization: true,
      allPromos: true
    }
  };

  let state = loadState();
  const app = document.querySelector('#app');
  const toast = document.querySelector('#toast');
  const modalRoot = document.querySelector('#modal-root');

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
    } catch (error) {
      console.warn('promos-prototype: failed to load local state; resetting', error);
      return structuredClone(defaultState);
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetPrototype() {
    state = structuredClone(defaultState);
    persist();
    closeModal();
    render();
    showToast('Prototype state reset.');
  }

  function icon(templateId) {
    return document.querySelector(`#${templateId}`)?.innerHTML || '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  }

  function render() {
    document.querySelectorAll('.persona-button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.mode === state.mode);
    });

    if (state.mode === 'shopper') renderShopper();
    if (state.mode === 'advertiser') renderAdvertiser();
    if (state.mode === 'admin') renderAdmin();
    persist();
  }

  function activeCampaigns() {
    return seedCampaigns.filter((campaign) => campaign.status === 'live' && !state.hidden.includes(campaign.id));
  }

  function filteredCampaigns() {
    const campaigns = activeCampaigns();
    if (state.category === 'For You') {
      const explicit = new Set(state.interests);
      return [...campaigns].sort((a, b) => {
        const aScore = explicit.has(a.category) ? 2 : 0;
        const bScore = explicit.has(b.category) ? 2 : 0;
        return bScore - aScore || b.saves - a.saves;
      });
    }
    return campaigns.filter((campaign) => campaign.category === state.category);
  }

  function shopperActionButton(campaign, type, label) {
    const active = type === 'like' ? state.liked.includes(campaign.id) : type === 'save' ? state.saved.includes(campaign.id) : false;
    const iconName = type === 'like' ? 'icon-heart' : type === 'save' ? 'icon-bookmark' : 'icon-share';
    const ariaState = active ? 'true' : 'false';
    return `<button class="icon-action ${active ? 'is-active' : ''}" data-action="${type}" data-id="${campaign.id}" aria-pressed="${ariaState}" aria-label="${label} ${escapeHtml(campaign.advertiser)}">${icon(iconName)}<span>${label}</span></button>`;
  }

  function renderSpotlight(campaign) {
    if (!campaign) {
      return `<div class="card card-pad"><strong>No live promotions right now.</strong><p class="helper">The module collapses safely instead of showing expired or broken creative.</p></div>`;
    }

    return `
      <section class="promo-spotlight" aria-label="Promoted offer from ${escapeHtml(campaign.advertiser)}">
        <div class="promo-spotlight-inner">
          <div class="promo-meta">
            <div class="promo-meta-left">
              <span class="sponsored-label">Promoted</span>
              <span class="advertiser-name">${escapeHtml(campaign.advertiser)}</span>
              ${campaign.verified ? '<span class="verified" title="Verified advertiser">✓ Verified</span>' : ''}
            </div>
            <button class="promo-menu" data-action="promo-menu" data-id="${campaign.id}" aria-label="Promotion options">•••</button>
          </div>
          <div class="promo-copy">
            <h3>${escapeHtml(campaign.headline)}</h3>
            <p>${escapeHtml(campaign.short)}</p>
          </div>
          <div class="promo-foot">
            <span class="promo-validity">${escapeHtml(campaign.validity)}</span>
            <div class="action-row">
              ${shopperActionButton(campaign, 'like', 'Like')}
              ${shopperActionButton(campaign, 'save', 'Save')}
              ${shopperActionButton(campaign, 'share', 'Share')}
              <button class="spotlight-cta" data-action="open-promo" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderFeedCard(campaign) {
    const likeCount = campaign.likes + (state.liked.includes(campaign.id) ? 1 : 0);
    const saveCount = campaign.saves + (state.saved.includes(campaign.id) ? 1 : 0);
    return `
      <article class="feed-card">
        <div class="feed-art ${campaign.variant}">
          <span class="art-badge">Promoted · ${escapeHtml(campaign.category)}</span>
          <div class="art-copy">
            <strong>${escapeHtml(campaign.headline)}</strong>
            <span>${escapeHtml(campaign.validity)}</span>
          </div>
        </div>
        <div class="feed-body">
          <div class="feed-topline">
            <div><strong>${escapeHtml(campaign.advertiser)} ${campaign.verified ? '✓' : ''}</strong><br><small>${escapeHtml(campaign.location)}</small></div>
            <button class="button button-ghost" data-action="promo-menu" data-id="${campaign.id}" aria-label="Promotion options">•••</button>
          </div>
          <p>${escapeHtml(campaign.short)}</p>
          <div class="feed-actions">
            <div class="feed-actions-left">
              ${shopperActionButton(campaign, 'like', `Like ${likeCount}`)}
              ${shopperActionButton(campaign, 'save', `Save ${saveCount}`)}
              ${shopperActionButton(campaign, 'share', 'Share')}
            </div>
            <button class="feed-cta" data-action="open-promo" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderShopper() {
    const visible = filteredCampaigns();
    const spotlight = activeCampaigns()[0];

    app.innerHTML = `
      <div class="page-stack">
        <div class="page-heading">
          <div>
            <span class="eyebrow">Shopper preview</span>
            <h1>Useful promotions, not random banners.</h1>
            <p>Test the Home Spotlight, category discovery, Like, Save, Share, explanations and advertiser entry point before production integration.</p>
          </div>
          <div class="page-heading-actions">
            <button class="button button-secondary" data-action="manage-interests">Interests</button>
            <button class="button button-primary" data-action="switch-mode" data-mode="advertiser">Advertise</button>
          </div>
        </div>

        <div class="mobile-frame">
          <div class="mobile-status"></div>
          <div class="mobile-content">
            <div class="mobile-topbar"><strong>Smart Shopper</strong><span class="avatar">JL</span></div>
            ${state.shopperTab === 'home' ? renderShopperHome(spotlight) : ''}
            ${state.shopperTab === 'promos' ? renderShopperPromos(visible) : ''}
            ${state.shopperTab === 'saved' ? renderSavedPromos() : ''}
            ${state.shopperTab === 'interests' ? renderInterestView() : ''}
            <nav class="mobile-nav" aria-label="Shopper prototype navigation">
              <button class="${state.shopperTab === 'home' ? 'is-active' : ''}" data-action="shopper-tab" data-tab="home">Home</button>
              <button class="${state.shopperTab === 'promos' ? 'is-active' : ''}" data-action="shopper-tab" data-tab="promos">Promos</button>
              <button class="${state.shopperTab === 'saved' ? 'is-active' : ''}" data-action="shopper-tab" data-tab="saved">Saved</button>
              <button class="${state.shopperTab === 'interests' ? 'is-active' : ''}" data-action="shopper-tab" data-tab="interests">Interests</button>
            </nav>
          </div>
        </div>
      </div>
    `;
  }

  function renderShopperHome(spotlight) {
    return `
      <div class="home-intro"><h2>Good morning</h2><p>Your shopping intelligence and useful offers in one place.</p></div>
      ${renderSpotlight(spotlight)}
      <div class="mini-grid">
        <div class="mini-card"><strong>${state.saved.length}</strong><span>Saved promos</span></div>
        <div class="mini-card"><strong>${state.interests.length}</strong><span>Interests</span></div>
        <div class="mini-card"><strong>2</strong><span>List matches</span></div>
      </div>
      <div class="promo-feed">
        <div class="section-title"><div><h3>Why this works</h3><p>Immediate intent can outrank generic profile assumptions.</p></div></div>
        <div class="inline-note">Example: if your active list contains chicken and detergent, matching promotions can rank higher without giving the advertiser access to your actual shopping list.</div>
        <button class="button button-secondary" data-action="shopper-tab" data-tab="promos">Browse all promos</button>
      </div>
    `;
  }

  function renderShopperPromos(campaigns) {
    return `
      <div class="home-intro"><span class="eyebrow">Promos</span><h2>Offers picked for you</h2><p>Browse directly by category or let Smart Shopper rank useful promotions.</p></div>
      <div class="promo-feed">
        <div class="category-strip" aria-label="Promotion categories">
          ${categories.map((category) => `<button class="category-chip ${state.category === category ? 'is-active' : ''}" data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}
        </div>
        ${campaigns.length ? campaigns.map(renderFeedCard).join('') : '<div class="inline-note">No live promotions in this category yet. Smart Shopper should not fill the space with irrelevant ads simply to increase volume.</div>'}
        <button class="button button-accent" data-action="switch-mode" data-mode="advertiser">Advertise on Smart Shopper</button>
      </div>
    `;
  }

  function renderSavedPromos() {
    const saved = seedCampaigns.filter((campaign) => state.saved.includes(campaign.id) && !state.hidden.includes(campaign.id));
    return `
      <div class="home-intro"><span class="eyebrow">Saved</span><h2>Your saved promos</h2><p>Saved offers can later support expiry reminders when the user opts into them.</p></div>
      <div class="promo-feed">
        ${saved.length ? saved.map(renderFeedCard).join('') : '<div class="inline-note">Nothing saved yet. Tap the bookmark glyph on a promotion to keep it here.</div>'}
      </div>
    `;
  }

  function renderInterestView() {
    return `
      <div class="home-intro"><span class="eyebrow">Control</span><h2>Your interests</h2><p>Explicit interests help, but Smart Shopper still treats people as multi-interest individuals rather than one fixed identity.</p></div>
      <div class="promo-feed">
        <div class="category-strip" style="flex-wrap:wrap;overflow:visible">
          ${categories.filter((c) => c !== 'For You').map((category) => {
            const selected = state.interests.includes(category);
            return `<button class="category-chip ${selected ? 'is-active' : ''}" data-action="interest" data-category="${escapeHtml(category)}" aria-pressed="${selected}">${escapeHtml(category)}</button>`;
          }).join('')}
        </div>
        <div class="inline-note">Sensitive traits are not inferred for ad targeting. A user may explicitly choose non-sensitive content categories, and can remove them at any time.</div>
      </div>
    `;
  }

  function statusClass(status) {
    if (status === 'Live') return 'status-live';
    if (status === 'Scheduled') return 'status-scheduled';
    if (status === 'Changes requested') return 'status-change';
    if (status === 'Rejected') return 'status-rejected';
    return 'status-review';
  }

  function renderAdvertiser() {
    app.innerHTML = `
      <div class="page-stack">
        <div class="page-heading">
          <div><span class="eyebrow">Advertiser workspace</span><h1>Make reach understandable and improvable.</h1><p>Advertisers see campaigns, real funnel metrics, reusable creatives, Promo Days and actionable optimization guidance without receiving private shopper data.</p></div>
          <div class="page-heading-actions">
            <button class="button button-secondary" data-action="reset">Reset preview</button>
            <button class="button button-primary" data-action="advertiser-section" data-section="create">Create campaign</button>
          </div>
        </div>
        <div class="category-strip">
          ${['overview','campaigns','create','analytics','credits'].map((section) => `<button class="category-chip ${state.advertiserSection === section ? 'is-active' : ''}" data-action="advertiser-section" data-section="${section}">${section === 'create' ? 'Create Campaign' : section[0].toUpperCase()+section.slice(1)}</button>`).join('')}
        </div>
        ${state.advertiserSection === 'overview' ? renderAdvertiserOverview() : ''}
        ${state.advertiserSection === 'campaigns' ? renderAdvertiserCampaigns() : ''}
        ${state.advertiserSection === 'create' ? renderCampaignBuilder() : ''}
        ${state.advertiserSection === 'analytics' ? renderAdvertiserAnalytics() : ''}
        ${state.advertiserSection === 'credits' ? renderCredits() : ''}
      </div>
    `;
  }

  function renderAdvertiserOverview() {
    const live = state.advertiserCampaigns.find((c) => c.status === 'Live') || state.advertiserCampaigns[0];
    return `
      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><div><h2>Overview</h2><p>Current account and campaign health.</p></div><span class="status-pill status-live">Premium Pro</span></div>
          <div class="kpi-grid" style="margin-top:14px">
            <div class="kpi"><strong>1</strong><span>Live campaigns</span><small>1 scheduled next</small></div>
            <div class="kpi"><strong>12.8k</strong><span>Current reach</span><small>+18% vs prior</small></div>
            <div class="kpi"><strong>311</strong><span>Saves</span><small>Strong intent signal</small></div>
            <div class="kpi"><strong>${state.promoDaysRemaining}</strong><span>Promo Days left</span><small>Renews Nov 1</small></div>
          </div>
        </section>
        <section class="panel two-thirds">
          <div class="section-title"><div><h3>${escapeHtml(live.name)}</h3><p>Reach → Interest → Intent → Action</p></div><button class="button button-secondary" data-action="advertiser-section" data-section="analytics">Full analytics</button></div>
          <div class="metric-funnel">
            <div class="funnel-step"><b>${live.impressions.toLocaleString()}</b><span>Impressions</span></div>
            <div class="funnel-step"><b>${live.likes}</b><span>Likes</span></div>
            <div class="funnel-step"><b>${live.saves}</b><span>Saves</span></div>
            <div class="funnel-step"><b>${live.shares}</b><span>Shares</span></div>
            <div class="funnel-step"><b>${live.cta}</b><span>CTA actions</span></div>
          </div>
        </section>
        <section class="panel third">
          <div class="section-title"><h3>Optimization assistant</h3></div>
          <div class="recommendation-card" style="margin-top:12px"><div class="recommendation-icon">↗</div><div><strong>Keep the evening window</strong><p>Your completed tech campaign converted better from 4–9 PM. Consider the same window when inventory is available.</p></div></div>
          <div class="recommendation-card" style="margin-top:9px"><div class="recommendation-icon">★</div><div><strong>Saves are healthy</strong><p>Current saves suggest real intent. Test a clearer CTA before changing audience targeting.</p></div></div>
        </section>
      </div>
    `;
  }

  function renderAdvertiserCampaigns() {
    return `
      <section class="panel">
        <div class="section-title"><div><h2>Campaigns</h2><p>Historical performance stays attached to the original campaign when a campaign is reused.</p></div></div>
        <div style="overflow:auto">
          <table class="data-table">
            <thead><tr><th>Campaign</th><th>Status</th><th>Placement</th><th>Dates</th><th>Engagement</th><th>Actions</th></tr></thead>
            <tbody>
              ${state.advertiserCampaigns.map((campaign) => `<tr><td><strong>${escapeHtml(campaign.name)}</strong><br><small>${escapeHtml(campaign.timeSlot)}</small></td><td><span class="status-pill ${statusClass(campaign.status)}">${escapeHtml(campaign.status)}</span></td><td>${escapeHtml(campaign.placement)}</td><td>${escapeHtml(campaign.dates)}</td><td>${escapeHtml(campaign.engagement)}</td><td><button class="button button-secondary" data-action="reuse-campaign" data-id="${campaign.id}">Reuse</button></td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderCampaignBuilder() {
    const steps = [
      [1, 'Basics'], [2, 'Creative'], [3, 'Action'], [4, 'Audience'], [5, 'Placement'], [6, 'Price'], [7, 'Preview'], [8, 'Pay & submit']
    ];
    return `
      <div class="form-layout">
        <aside class="step-list">
          ${steps.map(([num, label]) => `<button class="step-button ${state.campaignStep === num ? 'is-active' : ''}" data-action="campaign-step" data-step="${num}">${num}. ${label}</button>`).join('')}
        </aside>
        <section class="form-card">
          ${renderCampaignStep(state.campaignStep)}
        </section>
      </div>
    `;
  }

  function renderCampaignStep(step) {
    const d = state.campaignDraft;
    if (step === 1) return `
      <div class="section-title"><div><h2>Campaign basics</h2><p>Clear offer, dates and category before targeting or payment.</p></div></div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field full"><label>Internal campaign name</label><input data-field="name" value="${escapeHtml(d.name)}"></div>
        <div class="field"><label>Category</label><select data-field="category">${categories.filter(c=>c!=='For You').map(c=>`<option ${d.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Headline</label><input data-field="headline" value="${escapeHtml(d.headline)}"></div>
        <div class="field full"><label>Description</label><textarea data-field="description">${escapeHtml(d.description)}</textarea></div>
        <div class="field"><label>Start</label><input type="date" data-field="start" value="${escapeHtml(d.start)}"></div>
        <div class="field"><label>End</label><input type="date" data-field="end" value="${escapeHtml(d.end)}"></div>
      </div>
      ${builderNav(step)}
    `;
    if (step === 2) return `
      <div class="section-title"><div><h2>Creative</h2><p>Artwork is optional. Smart Shopper can provide a structured fallback creative.</p></div></div>
      <div class="detail-creative"><strong>${escapeHtml(d.headline)}</strong><span>${escapeHtml(d.description)}</span></div>
      <div class="inline-note" style="margin-top:12px">Prototype: image upload is intentionally not connected yet. Production will validate file type, dimensions, safe areas, alt text and content policy.</div>
      ${builderNav(step)}
    `;
    if (step === 3) return `
      <div class="section-title"><div><h2>Action</h2><p>Choose what a shopper should be able to do next.</p></div></div>
      <div class="form-grid" style="margin-top:14px"><div class="field full"><label>Primary CTA</label><select data-field="cta">${['View details','Claim offer','WhatsApp','Call','Website','Directions','Register','Book','Buy ticket'].map(v=>`<option ${d.cta===v?'selected':''}>${v}</option>`).join('')}</select></div></div>
      ${builderNav(step)}
    `;
    if (step === 4) return `
      <div class="section-title"><div><h2>Audience & relevance</h2><p>Advertiser supplies campaign context; Smart Shopper performs matching internally.</p></div></div>
      <div class="inline-note" style="margin-top:12px">Selected category: <strong>${escapeHtml(d.category)}</strong>. Production will support product/topic tags, location eligibility, contextual matching and broad-audience campaigns without exposing shopper identities.</div>
      <div class="warning-note inline-note" style="margin-top:9px">Sensitive traits are excluded from inference-based targeting.</div>
      ${builderNav(step)}
    `;
    if (step === 5) return `
      <div class="section-title"><div><h2>Placement & inventory</h2><p>Inventory is a real product constraint, not a cosmetic option.</p></div></div>
      <div class="package-grid" style="margin-top:14px">
        ${[
          ['feed-7','Promos Feed · 7 days','JMD $3,500'],
          ['home-3','Home Spotlight · 3 days','JMD $6,000'],
          ['evening-4','Featured evening · 4 days','JMD $8,500']
        ].map(([id,name,price])=>`<div class="package-card ${state.packageId===id?'is-selected':''}" data-action="package" data-package="${id}"><strong>${name}</strong><span>${price} · prototype pricing only</span></div>`).join('')}
      </div>
      ${builderNav(step)}
    `;
    if (step === 6) {
      const pricing = calculatePrototypePrice();
      return `
        <div class="section-title"><div><h2>Entitlements & price</h2><p>Premium benefits reduce what is due, but advertising is available without Premium.</p></div></div>
        <div class="checkout-summary">
          <div class="checkout-row"><span>Selected campaign</span><strong>${pricing.label}</strong></div>
          <div class="checkout-row"><span>Gross price</span><strong>${pricing.gross}</strong></div>
          <div class="checkout-row"><span>Premium benefit</span><strong>-${pricing.credit}</strong></div>
          <div class="checkout-row"><span>Promo Days remaining</span><strong>${state.promoDaysRemaining}</strong></div>
          <div class="checkout-row total"><span>Due today</span><strong>${pricing.due}</strong></div>
        </div>
        ${builderNav(step)}
      `;
    }
    if (step === 7) return `
      <div class="section-title"><div><h2>Final preview</h2><p>Review what shoppers will see before payment and moderation.</p></div></div>
      <div class="detail-creative"><strong>${escapeHtml(d.headline)}</strong><span>${escapeHtml(d.description)}</span></div>
      <div class="checkout-summary">
        <div class="checkout-row"><span>Category</span><strong>${escapeHtml(d.category)}</strong></div>
        <div class="checkout-row"><span>CTA</span><strong>${escapeHtml(d.cta)}</strong></div>
        <div class="checkout-row"><span>Dates</span><strong>${escapeHtml(d.start)} → ${escapeHtml(d.end)}</strong></div>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:11px;color:var(--secondary)"><input type="checkbox" checked> <span>I confirm the promotion follows Smart Shopper advertising policy. Payment submits the campaign for review.</span></label>
      ${builderNav(step)}
    `;
    const pricing = calculatePrototypePrice();
    return `
      <div class="section-title"><div><h2>Pay & submit</h2><p>Payment and submission happen in one streamlined transaction.</p></div></div>
      <div class="checkout-summary">
        <div class="checkout-row"><span>Due today</span><strong>${pricing.due}</strong></div>
        <div class="checkout-row"><span>After payment</span><strong>Paid · Under Review</strong></div>
        <div class="checkout-row"><span>Inventory</span><strong>Reserved during review</strong></div>
      </div>
      <div class="inline-note" style="margin-top:12px">Prototype only: pressing the button simulates a successful payment/submission. No card or payment data is collected.</div>
      <button class="button button-primary" style="width:100%;margin-top:14px" data-action="submit-campaign">Simulate payment & submit</button>
      ${builderNav(step, true)}
    `;
  }

  function builderNav(step, hideNext = false) {
    return `<div class="modal-actions">
      ${step > 1 ? `<button class="button button-secondary" data-action="campaign-step" data-step="${step - 1}">Back</button>` : ''}
      ${!hideNext && step < 8 ? `<button class="button button-primary" data-action="campaign-step" data-step="${step + 1}">Continue</button>` : ''}
    </div>`;
  }

  function calculatePrototypePrice() {
    const packages = {
      'feed-7': { label: 'Promos Feed · 7 days', gross: 3500, days: 7 },
      'home-3': { label: 'Home Spotlight · 3 days', gross: 6000, days: 3 },
      'evening-4': { label: 'Featured evening · 4 days', gross: 8500, days: 4 }
    };
    const selected = packages[state.packageId] || packages['feed-7'];
    const coveredDays = Math.min(state.promoDaysRemaining, selected.days);
    const dailyValue = Math.round(selected.gross / selected.days);
    const creditValue = Math.min(selected.gross, coveredDays * dailyValue);
    const due = Math.max(0, selected.gross - creditValue);
    return {
      label: selected.label,
      days: selected.days,
      gross: `JMD $${selected.gross.toLocaleString()}`,
      credit: `JMD $${creditValue.toLocaleString()}`,
      due: `JMD $${due.toLocaleString()}`,
      dueNumber: due
    };
  }

  function renderAdvertiserAnalytics() {
    const campaign = state.advertiserCampaigns[0];
    return `
      <div class="dashboard-grid">
        <section class="panel">
          <div class="section-title"><div><h2>${escapeHtml(campaign.name)}</h2><p>Funnel analytics with privacy-preserving aggregated reporting.</p></div></div>
          <div class="metric-funnel">
            <div class="funnel-step"><b>${campaign.impressions.toLocaleString()}</b><span>Reach</span></div>
            <div class="funnel-step"><b>${campaign.likes}</b><span>Likes</span></div>
            <div class="funnel-step"><b>${campaign.saves}</b><span>Saves</span></div>
            <div class="funnel-step"><b>${campaign.shares}</b><span>Shares</span></div>
            <div class="funnel-step"><b>${campaign.cta}</b><span>CTA</span></div>
          </div>
        </section>
        <section class="panel half"><div class="section-title"><h3>Interpretation</h3></div><div class="recommendation-card" style="margin-top:12px"><div class="recommendation-icon">i</div><div><strong>Saves are stronger than CTA clicks</strong><p>Do not change targeting first. Test clearer urgency or a stronger CTA so saved intent converts into action.</p></div></div></section>
        <section class="panel half"><div class="section-title"><h3>Privacy boundary</h3></div><div class="inline-note" style="margin-top:12px">The advertiser sees aggregated results. They do not see who saved the ad, private shopping lists, or an individual shopper's interest profile.</div></section>
      </div>
    `;
  }

  function renderCredits() {
    return `
      <section class="panel">
        <div class="section-title"><div><h2>Promo Days & credits</h2><p>Entitlements are tracked as a ledger, not a simple Premium=true flag.</p></div></div>
        <div class="kpi-grid" style="margin-top:14px">
          <div class="kpi"><strong>${state.promoDaysRemaining}</strong><span>Days remaining</span><small>Premium Pro</small></div>
          <div class="kpi"><strong>20</strong><span>Days granted</span><small>Current cycle</small></div>
          <div class="kpi"><strong>8</strong><span>Days consumed</span><small>2 campaigns</small></div>
          <div class="kpi"><strong>Nov 1</strong><span>Renews</span><small>Unused policy TBD</small></div>
        </div>
        <div class="inline-note" style="margin-top:14px">Production will record source, grant, consumption, expiry and restoration events so advertiser support can explain every balance change.</div>
      </section>
    `;
  }

  function renderAdmin() {
    app.innerHTML = `
      <div class="page-stack">
        <div class="page-heading">
          <div><span class="eyebrow">Admin operations preview</span><h1>Moderation, money, inventory and safety in one operating surface.</h1><p>This preview demonstrates the breadth of admin responsibilities. Production access must be role-based and enforced server-side.</p></div>
          <div class="page-heading-actions"><button class="button button-secondary" data-action="reset">Reset preview</button></div>
        </div>
        <div class="category-strip">
          ${['review','inventory','controls','support'].map(section=>`<button class="category-chip ${state.adminSection===section?'is-active':''}" data-action="admin-section" data-section="${section}">${section[0].toUpperCase()+section.slice(1)}</button>`).join('')}
        </div>
        ${state.adminSection === 'review' ? renderAdminReview() : ''}
        ${state.adminSection === 'inventory' ? renderAdminInventory() : ''}
        ${state.adminSection === 'controls' ? renderAdminControls() : ''}
        ${state.adminSection === 'support' ? renderAdminSupport() : ''}
      </div>
    `;
  }

  function renderAdminReview() {
    const pending = state.moderation.filter((item) => item.status === 'Under review');
    return `
      <div class="dashboard-grid">
        <section class="panel two-thirds">
          <div class="section-title"><div><h2>Review Queue</h2><p>Paid submissions remain reserved while moderation is completed.</p></div><span class="status-pill status-review">${pending.length} pending</span></div>
          <div style="margin-top:13px">
            ${state.moderation.map(item => `
              <article class="queue-card">
                <div><span class="status-pill ${item.status==='Approved'?'status-live':item.status==='Changes requested'?'status-change':item.status==='Rejected'?'status-rejected':'status-review'}">${escapeHtml(item.status)}</span><h4 style="margin-top:8px">${escapeHtml(item.campaign)}</h4><p><strong>${escapeHtml(item.advertiser)}</strong> · ${escapeHtml(item.payment)}<br>${escapeHtml(item.placement)}<br>${escapeHtml(item.note)}</p></div>
                <div class="queue-actions">
                  <button class="button button-secondary" data-action="moderation" data-id="${item.id}" data-status="Changes requested">Request changes</button>
                  <button class="button button-primary" data-action="moderation" data-id="${item.id}" data-status="Approved">Approve</button>
                  <button class="button button-danger" data-action="moderation" data-id="${item.id}" data-status="Rejected">Reject + refund</button>
                </div>
              </article>`).join('')}
          </div>
        </section>
        <section class="panel third">
          <div class="section-title"><h3>Queue health</h3></div>
          <div class="kpi" style="margin-top:12px"><strong>${pending.length}</strong><span>Awaiting review</span><small>Target SLA not yet set</small></div>
          <div class="inline-note" style="margin-top:10px">Automated safety checks may prioritize review, but the prototype keeps human moderation authority visible.</div>
        </section>
      </div>
    `;
  }

  function renderAdminInventory() {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    return `
      <section class="panel">
        <div class="section-title"><div><h2>Home Spotlight inventory</h2><p>Paid-under-review reservations count against capacity so inventory is not double-sold.</p></div></div>
        <div class="inventory-grid">
          ${days.map((day,index)=>`<div class="inventory-cell ${index===4||index===5?'is-heavy':'is-open'}"><strong>${day}</strong><span>${index===4||index===5?'Evening nearly full':'Capacity available'}</span><span>${index===5?'2 paid under review':'1 scheduled'}</span></div>`).join('')}
        </div>
        <div class="warning-note inline-note" style="margin-top:12px">Production inventory reservation must be transactional and idempotent. A successful payment must not result in overselling an exclusive slot.</div>
      </section>
    `;
  }

  function renderAdminControls() {
    const controls = [
      ['allPromos','Promos delivery','Emergency pause all currently served promos.'],
      ['submissions','Campaign submissions','Allow advertisers to create and submit new campaigns.'],
      ['payments','New payments','Allow campaign checkout/payment attempts.'],
      ['personalization','Personalized ranking','Disable learned/personalized ranking while preserving safe contextual/broad delivery.']
    ];
    return `
      <section class="panel">
        <div class="section-title"><div><h2>System controls</h2><p>Emergency actions are explicit, auditable and reversible.</p></div></div>
        <div class="admin-controls" style="margin-top:14px">
          ${controls.map(([key,label,description])=>`<div class="control-card"><strong>${label}</strong><p>${description}</p><button class="toggle ${state.systemControls[key]?'is-on':''}" data-action="control" data-control="${key}" aria-pressed="${state.systemControls[key]}"></button></div>`).join('')}
        </div>
        <div class="danger-note inline-note" style="margin-top:12px">Production toggles require strong authorization, reason capture and append-only audit events. They must not be implemented as client-only switches.</div>
      </section>
    `;
  }

  function renderAdminSupport() {
    return `
      <div class="dashboard-grid">
        <section class="panel half"><div class="section-title"><h2>Advertiser support profile</h2></div><div class="data-table" style="display:grid;gap:10px;margin-top:12px"><div><strong>FreshMart Jamaica</strong><br><small>Verified advertiser · 6 campaigns</small></div><div class="inline-note">Support should be able to see payments, entitlement ledger, moderation history, refunds, warnings and authored notes without needing full super-admin privileges.</div></div></section>
        <section class="panel half"><div class="section-title"><h2>Audit expectation</h2></div><div class="inline-note" style="margin-top:12px">Every moderation, refund, credit, emergency-control and account-restriction action records actor, timestamp, reason, previous state and resulting state.</div></section>
      </div>
    `;
  }

  function openPromo(id) {
    const campaign = seedCampaigns.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <article class="modal-card" role="dialog" aria-modal="true" aria-labelledby="promo-detail-title" data-modal-card>
          <div class="modal-header"><div><span class="eyebrow">Promoted</span><h3 id="promo-detail-title">${escapeHtml(campaign.advertiser)} ${campaign.verified ? '✓' : ''}</h3><p>${escapeHtml(campaign.location)}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
          <div class="detail-creative"><strong>${escapeHtml(campaign.headline)}</strong><span>${escapeHtml(campaign.short)}</span></div>
          <div class="detail-info">
            <p style="margin:0;color:var(--secondary);font-size:12px;line-height:1.6">${escapeHtml(campaign.detail)}</p>
            <div class="detail-row"><span>Valid</span><strong>${escapeHtml(campaign.validity)}</strong></div>
            <div class="detail-row"><span>Category</span><strong>${escapeHtml(campaign.category)}</strong></div>
            <div class="detail-row"><span>Location</span><strong>${escapeHtml(campaign.location)}</strong></div>
          </div>
          <div class="modal-actions">
            ${shopperActionButton(campaign, 'like', 'Like')}
            ${shopperActionButton(campaign, 'save', 'Save')}
            ${shopperActionButton(campaign, 'share', 'Share')}
            <button class="button button-primary" data-action="cta" data-id="${campaign.id}">${escapeHtml(campaign.cta)}</button>
          </div>
        </article>
      </div>`;
  }

  function openPromoMenu(id) {
    const campaign = seedCampaigns.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card" role="dialog" aria-modal="true" data-modal-card>
          <div class="modal-header"><div><h3>Promotion options</h3><p>${escapeHtml(campaign.advertiser)}</p></div><button class="modal-close" data-action="close-modal" aria-label="Close">×</button></div>
          <div style="display:grid;gap:8px;margin-top:14px">
            <button class="button button-secondary" data-action="why-promo" data-id="${campaign.id}">Why am I seeing this?</button>
            <button class="button button-secondary" data-action="not-interested" data-id="${campaign.id}">Not interested</button>
            <button class="button button-secondary" data-action="hide" data-id="${campaign.id}">Hide this advertiser/campaign</button>
            <button class="button button-danger" data-action="report" data-id="${campaign.id}">Report ad</button>
          </div>
        </div>
      </div>`;
  }

  function openWhyPromo(id) {
    const campaign = seedCampaigns.find((item) => item.id === id);
    if (!campaign) return;
    modalRoot.innerHTML = `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal-card" role="dialog" aria-modal="true" data-modal-card>
          <div class="modal-header"><div><h3>Why you're seeing this</h3><p>Smart Shopper keeps explanations high-level and avoids exposing or inferring sensitive traits.</p></div><button class="modal-close" data-action="close-modal">×</button></div>
          <div class="inline-note" style="margin-top:14px">${escapeHtml(campaign.targetingReason)}</div>
          <div class="modal-actions"><button class="button button-secondary" data-action="manage-interests">Manage interests</button></div>
        </div>
      </div>`;
  }

  function openInterests() {
    closeModal();
    state.mode = 'shopper';
    state.shopperTab = 'interests';
    render();
  }

  function closeModal() {
    modalRoot.innerHTML = '';
  }

  function toggleArrayValue(array, value) {
    const index = array.indexOf(value);
    if (index >= 0) array.splice(index, 1);
    else array.push(value);
  }

  async function shareCampaign(id) {
    const campaign = seedCampaigns.find((item) => item.id === id);
    if (!campaign) return;
    const payload = {
      title: `${campaign.advertiser} · ${campaign.headline}`,
      text: campaign.short,
      url: `${location.href.split('#')[0]}#promo=${encodeURIComponent(campaign.id)}`
    };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`);
        showToast('Promo link copied.');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Sharing was not available.');
    }
  }

  function submitCampaign() {
    const pricing = calculatePrototypePrice();
    const usedDays = Math.min(state.promoDaysRemaining, pricing.days);
    state.promoDaysRemaining -= usedDays;
    const newCampaign = {
      id: `adv_cmp_${Date.now()}`,
      name: state.campaignDraft.name || 'Untitled campaign',
      status: 'Under review',
      placement: pricing.label.split(' · ')[0],
      dates: `${state.campaignDraft.start}–${state.campaignDraft.end}`,
      timeSlot: state.campaignDraft.timeSlot,
      spend: pricing.dueNumber ? pricing.due : `${usedDays} Promo Days`,
      impressions: 0,
      likes: 0,
      saves: 0,
      shares: 0,
      cta: 0,
      engagement: '—'
    };
    state.advertiserCampaigns.unshift(newCampaign);
    state.advertiserSection = 'campaigns';
    state.campaignStep = 1;
    showToast('Payment simulated. Campaign is now Paid · Under Review.');
    render();
  }

  function reuseCampaign(id) {
    const campaign = state.advertiserCampaigns.find((item) => item.id === id);
    if (!campaign) return;
    state.campaignDraft.name = `${campaign.name} · Copy`;
    state.advertiserSection = 'create';
    state.campaignStep = 1;
    showToast('Campaign copied into a new draft. Dates and offer must be rechecked.');
    render();
  }

  function moderate(id, status) {
    const item = state.moderation.find((entry) => entry.id === id);
    if (!item) return;
    item.status = status;
    if (status === 'Rejected') showToast('Prototype: campaign rejected and refund/restoration queued.');
    else if (status === 'Changes requested') showToast('Changes requested. Payment and reservation remain intact.');
    else showToast('Campaign approved. It can now move to scheduling.');
    render();
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action], .persona-button');
    if (!target) return;

    if (target.matches('.persona-button')) {
      state.mode = target.dataset.mode;
      render();
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === 'switch-mode') { state.mode = target.dataset.mode; render(); }
    if (action === 'go-shopper') { state.mode = 'shopper'; state.shopperTab = 'home'; render(); }
    if (action === 'shopper-tab') { state.shopperTab = target.dataset.tab; render(); }
    if (action === 'category') { state.category = target.dataset.category; render(); }
    if (action === 'interest') { toggleArrayValue(state.interests, target.dataset.category); render(); }
    if (action === 'manage-interests') openInterests();
    if (action === 'like') { toggleArrayValue(state.liked, id); persist(); render(); if (modalRoot.innerHTML) openPromo(id); }
    if (action === 'save') { toggleArrayValue(state.saved, id); persist(); render(); if (modalRoot.innerHTML) openPromo(id); }
    if (action === 'share') shareCampaign(id);
    if (action === 'open-promo') openPromo(id);
    if (action === 'promo-menu') openPromoMenu(id);
    if (action === 'why-promo') openWhyPromo(id);
    if (action === 'not-interested') { if (!state.hidden.includes(id)) state.hidden.push(id); closeModal(); render(); showToast('We will show fewer promotions like this.'); }
    if (action === 'hide') { if (!state.hidden.includes(id)) state.hidden.push(id); closeModal(); render(); showToast('Promotion hidden.'); }
    if (action === 'report') { if (!state.reports.includes(id)) state.reports.push(id); closeModal(); showToast('Report recorded in the prototype.'); }
    if (action === 'cta') showToast('CTA recorded. Production can open an internal action or approved external destination.');
    if (action === 'close-modal' && !event.target.closest('[data-modal-card]')) closeModal();
    if (action === 'advertiser-section') { state.advertiserSection = target.dataset.section; render(); }
    if (action === 'campaign-step') { state.campaignStep = Number(target.dataset.step); render(); }
    if (action === 'package') { state.packageId = target.dataset.package; render(); }
    if (action === 'submit-campaign') submitCampaign();
    if (action === 'reuse-campaign') reuseCampaign(id);
    if (action === 'admin-section') { state.adminSection = target.dataset.section; render(); }
    if (action === 'moderation') moderate(id, target.dataset.status);
    if (action === 'control') { const key = target.dataset.control; state.systemControls[key] = !state.systemControls[key]; render(); showToast(`${key} set to ${state.systemControls[key] ? 'enabled' : 'paused'} in prototype.`); }
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

  // Prevent clicks inside modal content from closing the backdrop.
  modalRoot.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-card]')) event.stopPropagation();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('promos-prototype: service worker registration failed', error);
    });
  }

  render();
})();
