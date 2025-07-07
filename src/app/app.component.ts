import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false
})
export class AppComponent {
  isOnline: boolean = true;

  constructor(
    private router: Router,
    private platform: Platform
  ) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      document.body.classList.toggle('dark', false);

      // Initial check
      this.checkNetworkStatus();

      // Listen to online/offline events
      window.addEventListener('online', () => this.setNetworkStatus(true));
      window.addEventListener('offline', () => this.setNetworkStatus(false));

      if (navigator.onLine) {
        this.router.navigateByUrl('/screen');
      }
    });
  }

  setNetworkStatus(status: boolean) {
    this.isOnline = status;

    if (status) {
      // Redirige automatiquement si l'app était offline
      this.router.navigateByUrl('/screen');
    }
  }

  checkNetworkStatus() {
    this.setNetworkStatus(navigator.onLine);
  }

  manualReload() {
    this.checkNetworkStatus();
  }
}
