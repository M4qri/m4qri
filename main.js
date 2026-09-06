(function () {
  'use strict';

  const body = document.body;
  const menuBtn = document.getElementById('menuToggle');
  const panel = document.getElementById('mobilePanel');

  if (menuBtn && panel) {
    menuBtn.addEventListener('click', () => {
      const open = !panel.classList.contains('open');
      panel.classList.toggle('open', open);
      menuBtn.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });

    panel.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        panel.classList.remove('open');
        menuBtn.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      })
    );
  }

  const themeBtn = document.getElementById('themeToggle');
  let saved = null;
  try {
    saved = localStorage.getItem('m4qri-theme');
  } catch (_) {
    saved = null;
  }
  if (saved === 'dark') body.classList.add('dark');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      body.classList.toggle('dark');
      try {
        localStorage.setItem('m4qri-theme', body.classList.contains('dark') ? 'dark' : 'light');
      } catch (_) {
        // The theme still works even when storage is unavailable.
      }
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const instant = document.querySelectorAll('.reveal-now,.reveal-from-left,.reveal-from-right');
  requestAnimationFrame(() => instant.forEach((el) => el.classList.add('visible')));

  const obs = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              obs.unobserve(entry.target);
            }
          }),
        { threshold: 0.08, rootMargin: '0px 0px -50px 0px' }
      )
    : null;

  document.querySelectorAll('.reveal:not(.reveal-now)').forEach((el) =>
    obs ? obs.observe(el) : el.classList.add('visible')
  );

  const budgetValue = document.getElementById('budgetValue');
  const budgetButtons = document.querySelectorAll('.budget-btn');
  budgetButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      budgetButtons.forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (budgetValue) budgetValue.value = btn.dataset.budget || '';
    })
  );

  function showToast(message, isError) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(isError));
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 5000);
  }

  function resetContactForm(form) {
    form.reset();
    budgetButtons.forEach((b) => b.classList.toggle('selected', b.dataset.budget === '10–25k MAD'));
    if (budgetValue) budgetValue.value = '10–25k MAD';
    const started = document.getElementById('formStarted');
    if (started) started.value = String(Date.now());
  }

  const form = document.getElementById('contactForm');
  if (form) {
    const submit = document.getElementById('submitBtn');
    const started = document.getElementById('formStarted');
    if (started) started.value = String(Date.now());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (!submit || submit.disabled) return;

      const formData = new FormData(form);
      const clientName = String(formData.get('Name') || '').trim();
      const clientEmail = String(formData.get('Email') || '').trim();
      const company = String(formData.get('Company') || '').trim();
      const budget = String(formData.get('Budget') || '').trim();
      const projectDetails = String(formData.get('Project Details') || '').trim();
      const honey = String(formData.get('_honey') || '').trim();
      const formStarted = String(formData.get('_started') || '').trim();

      // Quietly drop obvious bot submissions that fill the hidden honeypot.
      if (honey) {
        resetContactForm(form);
        return;
      }

      // Defense-in-depth client limits. The server repeats these checks.
      if (
        clientName.length < 2 ||
        clientName.length > 80 ||
        clientEmail.length > 254 ||
        company.length > 120 ||
        projectDetails.length < 20 ||
        projectDetails.length > 3000
      ) {
        showToast('Please check the form fields and try again.', true);
        return;
      }

      const payload = {
        _subject: `NEW BOOK A CALL — ${clientName || 'New client'}`,
        _template: 'box',
        _replyto: clientEmail,
        _honey: honey,
        _started: formStarted,
        Name: clientName,
        Email: clientEmail,
        Company: company || 'Not provided',
        Budget: budget || 'Not selected',
        'Project Details': projectDetails
      };

      submit.disabled = true;
      submit.textContent = 'SENDING...';

      try {
        let response;
        let usedOwnBackend = true;

        try {
          response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'same-origin',
            referrerPolicy: 'strict-origin-when-cross-origin'
          });

          // A static host has no /api/contact. Only then fall back to FormSubmit.
          if (response.status === 404 || response.status === 405) {
            usedOwnBackend = false;
          }
        } catch (_) {
          usedOwnBackend = false;
        }

        if (!usedOwnBackend) {
          const endpoint = form.dataset.ajaxEndpoint;
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            referrerPolicy: 'strict-origin-when-cross-origin'
          });
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          if (response.status === 429) {
            throw new Error('RATE_LIMITED');
          }
          throw new Error('SUBMISSION_FAILED');
        }

        resetContactForm(form);
        showToast("Message sent! I'll reply within 2 working days.", false);
      } catch (error) {
        if (error && error.message === 'RATE_LIMITED') {
          showToast('Too many attempts. Please wait a few minutes and try again.', true);
        } else {
          showToast('Could not send your message. Please try again, or email adiloxyt21@gmail.com directly.', true);
        }
      } finally {
        submit.disabled = false;
        submit.textContent = 'SEND';
      }
    });
  }
})();
