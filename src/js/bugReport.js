const STRINGS = {
    en: {
        button: 'Report a problem',
        title: 'Report a problem',
        subtitle: 'Send a bug or feedback directly to the Aireon team.',
        typeLabel: 'Report type',
        bug: 'Bug',
        feedback: 'Feedback',
        messageLabel: 'What happened?',
        bugPlaceholder: 'Tell us what went wrong and what you expected.',
        feedbackPlaceholder: 'Tell us what would make this app better.',
        emailLabel: 'Email (optional)',
        emailPlaceholder: 'you@example.com',
        send: 'Send report',
        sending: 'Sending...',
        successTitle: 'Thanks - report sent.',
        successBody: 'We received your note and included this page context.',
        error: 'Could not send the report. Please try again.',
        close: 'Close',
    },
    fr: {
        button: 'Signaler un probleme',
        title: 'Signaler un probleme',
        subtitle: 'Envoyez un bug ou un feedback directement a l equipe Aireon.',
        typeLabel: 'Type de message',
        bug: 'Bug',
        feedback: 'Feedback',
        messageLabel: 'Que s est-il passe ?',
        bugPlaceholder: 'Expliquez ce qui ne marche pas et ce que vous attendiez.',
        feedbackPlaceholder: 'Dites-nous ce qui ameliorerait cette app.',
        emailLabel: 'Email (optionnel)',
        emailPlaceholder: 'vous@example.com',
        send: 'Envoyer',
        sending: 'Envoi...',
        successTitle: 'Merci - message envoye.',
        successBody: 'Nous avons recu votre note avec le contexte de cette page.',
        error: 'Impossible d envoyer le message. Reessayez.',
        close: 'Fermer',
    },
    de: {
        button: 'Problem melden',
        title: 'Problem melden',
        subtitle: 'Senden Sie einen Bug oder Feedback direkt an das Aireon Team.',
        typeLabel: 'Meldungstyp',
        bug: 'Bug',
        feedback: 'Feedback',
        messageLabel: 'Was ist passiert?',
        bugPlaceholder: 'Beschreiben Sie, was nicht funktioniert und was Sie erwartet haben.',
        feedbackPlaceholder: 'Sagen Sie uns, was diese App besser machen wurde.',
        emailLabel: 'E-Mail (optional)',
        emailPlaceholder: 'sie@example.com',
        send: 'Meldung senden',
        sending: 'Senden...',
        successTitle: 'Danke - Meldung gesendet.',
        successBody: 'Wir haben Ihre Notiz mit dem Kontext dieser Seite erhalten.',
        error: 'Die Meldung konnte nicht gesendet werden. Bitte erneut versuchen.',
        close: 'Schliessen',
    },
    it: {
        button: 'Segnala un problema',
        title: 'Segnala un problema',
        subtitle: 'Invia un bug o feedback direttamente al team Aireon.',
        typeLabel: 'Tipo di segnalazione',
        bug: 'Bug',
        feedback: 'Feedback',
        messageLabel: 'Che cosa e successo?',
        bugPlaceholder: 'Descrivi cosa non funziona e cosa ti aspettavi.',
        feedbackPlaceholder: 'Dicci cosa renderebbe migliore questa app.',
        emailLabel: 'Email (opzionale)',
        emailPlaceholder: 'tu@example.com',
        send: 'Invia segnalazione',
        sending: 'Invio...',
        successTitle: 'Grazie - segnalazione inviata.',
        successBody: 'Abbiamo ricevuto la nota con il contesto di questa pagina.',
        error: 'Impossibile inviare la segnalazione. Riprova.',
        close: 'Chiudi',
    },
};

function getStrings() {
    const lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
    if (lang.startsWith('fr')) return STRINGS.fr;
    if (lang.startsWith('de')) return STRINGS.de;
    if (lang.startsWith('it')) return STRINGS.it;
    return STRINGS.en;
}

function compact(value) {
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, item]) => item !== undefined && item !== null && item !== '')
            .map(([key, item]) => [key, item && typeof item === 'object' && !Array.isArray(item) ? compact(item) : item]),
    );
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

export function setupBugReport({ appName, endpoint = '/api/errorlog-collect', metaData = {} } = {}) {
    if (!appName || document.getElementById('aireon-bug-report-root')) return;

    const t = getStrings();
    const titleId = 'aireon-bug-report-title';
    const root = document.createElement('div');
    root.id = 'aireon-bug-report-root';
    root.innerHTML = `
        <button class="aireon-bug-launcher" type="button" aria-label="${t.button}" title="${t.button}">
            <i data-lucide="bug" aria-hidden="true"></i>
        </button>
        <div class="aireon-bug-overlay" hidden>
            <form class="aireon-bug-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
                <button class="aireon-bug-close" type="button" aria-label="${t.close}" title="${t.close}">
                    <i data-lucide="x" aria-hidden="true"></i>
                </button>
                <div class="aireon-bug-head">
                    <span class="aireon-bug-head-icon"><i data-lucide="bug" aria-hidden="true"></i></span>
                    <div>
                        <h2 id="${titleId}">${t.title}</h2>
                        <p>${t.subtitle}</p>
                    </div>
                </div>
                <div class="aireon-bug-type" role="group" aria-label="${t.typeLabel}">
                    <button type="button" class="is-active" data-report-type="bug" aria-pressed="true">${t.bug}</button>
                    <button type="button" data-report-type="feedback" aria-pressed="false">${t.feedback}</button>
                </div>
                <label class="aireon-bug-field">
                    <span>${t.messageLabel}</span>
                    <textarea rows="5" name="message" required placeholder="${t.bugPlaceholder}"></textarea>
                </label>
                <label class="aireon-bug-field">
                    <span>${t.emailLabel}</span>
                    <input type="email" name="email" autocomplete="email" placeholder="${t.emailPlaceholder}" />
                </label>
                <p class="aireon-bug-status" role="status" aria-live="polite"></p>
                <button class="aireon-bug-submit" type="submit" disabled>
                    <i data-lucide="send" aria-hidden="true"></i>
                    <span>${t.send}</span>
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(root);

    const launcher = root.querySelector('.aireon-bug-launcher');
    const overlay = root.querySelector('.aireon-bug-overlay');
    const dialog = root.querySelector('.aireon-bug-dialog');
    const closeButton = root.querySelector('.aireon-bug-close');
    const typeButtons = [...root.querySelectorAll('[data-report-type]')];
    const message = root.querySelector('textarea[name="message"]');
    const email = root.querySelector('input[name="email"]');
    const submit = root.querySelector('.aireon-bug-submit');
    const submitLabel = submit.querySelector('span');
    const status = root.querySelector('.aireon-bug-status');
    let reportType = 'bug';
    let restoreFocus = null;

    function setStatus(text, mode = '') {
        status.textContent = text;
        status.dataset.mode = mode;
    }

    function setType(type) {
        reportType = type;
        typeButtons.forEach((button) => {
            const active = button.dataset.reportType === type;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        message.placeholder = type === 'feedback' ? t.feedbackPlaceholder : t.bugPlaceholder;
    }

    function setSending(sending) {
        message.disabled = sending;
        email.disabled = sending;
        submit.disabled = sending || !message.value.trim();
        submitLabel.textContent = sending ? t.sending : t.send;
    }

    function open() {
        restoreFocus = document.activeElement;
        overlay.hidden = false;
        window.setTimeout(() => message.focus(), 40);
        refreshIcons();
    }

    function close() {
        overlay.hidden = true;
        dialog.reset();
        setType('bug');
        setStatus('');
        setSending(false);
        restoreFocus?.focus?.();
    }

    launcher.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    overlay.addEventListener('mousedown', (event) => {
        if (event.target === overlay) close();
    });
    window.addEventListener('keydown', (event) => {
        if (!overlay.hidden && event.key === 'Escape') close();
    });
    typeButtons.forEach((button) => {
        button.addEventListener('click', () => setType(button.dataset.reportType));
    });
    message.addEventListener('input', () => {
        submit.disabled = !message.value.trim();
    });
    dialog.addEventListener('submit', async (event) => {
        event.preventDefault();
        const text = message.value.trim();
        if (!text) return;
        setSending(true);
        setStatus('');
        const payload = compact({
            app_name: appName.toLowerCase(),
            message: text,
            severity: 'info',
            kind: 'user_report',
            page_url: window.location.href,
            user_agent: navigator.userAgent,
            user_email: email.value.trim(),
            meta_data: {
                source: 'bug_report_widget',
                report_type: reportType,
                rollout: 'bug-report-suite',
                ...metaData,
            },
        });

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setStatus(t.successBody, 'success');
            submitLabel.textContent = t.successTitle;
            window.setTimeout(close, 1800);
        } catch (error) {
            console.error('Bug report dispatch failed:', error);
            setStatus(t.error, 'error');
            setSending(false);
        }
    });

    refreshIcons();
}
