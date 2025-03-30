import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth'; // Import Firebase Auth
import { onAuthStateChanged } from 'firebase/auth'; // Utiliser l'observateur d'état


@Component({
  selector: 'app-screen',
  templateUrl: './screen.page.html',
  styleUrls: ['./screen.page.scss'],
  standalone: false,
})
export class ScreenPage implements OnInit {

  isLoading: boolean = true; // Indique si le loader est actif

  constructor(private router: Router, private auth: Auth) {}

  ngOnInit() {
    this.checkAuthentication(); // Vérifie immédiatement l'état de connexion
  }

  private checkAuthentication(): void {
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        const previousUrl = localStorage.getItem('previousUrl');
        if (previousUrl) {
          setTimeout(() => {
            this.router.navigateByUrl(previousUrl); // Redirige vers l'URL précédente après 3 secondes
            this.isLoading = false; // Désactive le loader après la redirection
          }, 3000);
        } else {
          setTimeout(() => {
            this.router.navigate(['/tabs/tab1']); // Page par défaut pour les utilisateurs connectés après 3 secondes
            this.isLoading = false; // Désactive le loader après la redirection
          }, 3000);
        }
      } else {
        setTimeout(() => {
          this.router.navigate(['/connexion']); // Redirige vers la page de connexion après 3 secondes
          this.isLoading = false; // Désactive le loader après la redirection
        }, 3000);
      }
    });
  }
}
