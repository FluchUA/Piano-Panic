import { requestExpandedMode } from '@devvit/web/client';
import type { SplashInfoResponse } from '../shared/api';

const fallbackInfo: SplashInfoResponse = {
    mode: 'hub',
    title: 'WELCOME TO THE STUDIO!',
    buttonLabel: 'Enter Studio',
};

const title = document.getElementById('splash-title');
const button = document.querySelector<HTMLButtonElement>('#enter-button');

// Applies copy returned by the server
function renderSplashInfo(info: SplashInfoResponse) {
    if (title) title.textContent = info.title;
    if (button) button.textContent = info.buttonLabel;
}

// Reads lightweight post state for the inline view
async function loadSplashInfo() {
    try {
        const response = await fetch('/api/splash-info', {
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) return;

        const info: SplashInfoResponse = await response.json();
        renderSplashInfo(info);
    } catch {
        renderSplashInfo(fallbackInfo);
    }
}

// Opens the full game entrypoint
function openGame(event: MouseEvent) {
    if (!button) return;

    button.disabled = true;
    button.classList.add('is-loading');

    try {
        requestExpandedMode(event, 'game');
    } catch {
        button.disabled = false;
        button.classList.remove('is-loading');
    }
}

renderSplashInfo(fallbackInfo);
button?.addEventListener('click', openGame);
void loadSplashInfo();
