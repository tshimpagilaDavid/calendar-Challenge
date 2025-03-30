import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,

})
export class AppComponent {
  constructor(
    private router: Router,
    private platform: Platform,
  ) {
    this.initializeApp(); // Appeler initializeApp() dans le constructeur
  }

  initializeApp() {
    this.platform.ready().then(() => {
      // Redirection vers l'écran d'introduction à chaque initialisation
      this.router.navigateByUrl('/screen');
      // Forcer le thème clair
      document.body.classList.toggle('dark', false); // Désactive le mode sombre
    });
  }
}