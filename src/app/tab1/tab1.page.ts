import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged, User, signOut } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import {
  Firestore,
  doc,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  updateDoc
} from '@angular/fire/firestore';
import { auth } from 'firebase-admin';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false
})
export class Tab1Page implements OnInit {
  connected: boolean = false;
  employe: any = null;
  entrepriseNom: string = ''; // Nom de l'entreprise (l'ID du document dans la collection entreprises)
  formation: any = null; // Formation en cours assignée à l'employé
  currentDay: number = 1;
  currentDayChallenges: Array<{ description: string; completed: boolean }> = [];
  private _storage: Storage | null = null;


  constructor(
    private router: Router,
    private afAuth: Auth,
    private alertController: AlertController,
    private firestore: Firestore,
    private storage: Storage  ) {
    this.checkAuthState();
  }

  async ngOnInit() {
    await this.initStorage(); // Initialise Storage avant utilisation
    await this.loadStoredDay();
  }

  async initStorage() {
    this._storage = await this.storage.create();
  }

  async loadStoredDay() {
    if (this._storage) {
      const storedDay = await this._storage.get('currentDay');
      if (storedDay) {
        this.currentDay = storedDay;
      }
    }
  }

  private checkAuthState() {
    onAuthStateChanged(this.afAuth, async (user: User | null) => {
      if (user) {
        this.connected = true;
        await this.getEmployeData(user.uid);  // Récupérer les données de l'employé
      } else {
        this.connected = false;
      }
    });
  }

  private async getEmployeData(userId: string) {
    try {
      // Référence à la collection "entreprises"
      const entreprisesCollectionRef = collection(this.firestore, 'entreprises');
      const entreprisesSnapshot = await getDocs(entreprisesCollectionRef);
  
      // Parcourir chaque entreprise pour trouver l'employé
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const entrepriseId = entrepriseDoc.id; // Récupérer l'ID de l'entreprise
  
        // Référence à la sous-collection "employes"
        const employeDocRef = doc(this.firestore, `entreprises/${entrepriseId}/employes/${userId}`);
        const employeSnapshot = await getDoc(employeDocRef);
  
        if (employeSnapshot.exists()) {
          this.employe = employeSnapshot.data();
          console.log(`Employé trouvé dans l'entreprise ID: ${entrepriseId}`);
          
          // Charger les formations de l'employé
          const formationsRef = collection(employeDocRef, 'formations');
          const q = query(formationsRef, where('statut', '==', 'En cours'));
          const querySnapshot = await getDocs(q);
  
          if (!querySnapshot.empty) {
            this.formation = querySnapshot.docs[0].data();
            this.formation.id = querySnapshot.docs[0].id;
            console.log('Formation en cours trouvée:', this.formation);
            this.loadChallengesForDay();
          } else {
            console.log("Aucune formation en cours trouvée !");
          }
          
          return; // Arrêter la boucle dès qu'on trouve l'employé
        }
      }
  
      console.error('Employé non trouvé dans aucune entreprise.');
    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    }
  }  

  loadChallengesForDay() {
    if (this.formation && this.formation.defis && this.formation.defis[this.currentDay - 1]) {
      const dayData = this.formation.defis[this.currentDay - 1];
      if (dayData.defis && Array.isArray(dayData.defis)) {
        this.currentDayChallenges = dayData.defis.map((challenge: string) => ({
          description: challenge,
          completed: false  // Par défaut, aucun défi n'est complété au chargement
        }));
      } else {
        this.currentDayChallenges = [];
      }
    } else {
      this.currentDayChallenges = [];
    }
  }

  nextDay() {
    if (this.formation && this.formation.defis && this.currentDay < this.formation.defis.length) {
      this.currentDay++;
      this.loadChallengesForDay();
      localStorage.setItem('currentDay', this.currentDay.toString()); // 🔥 Mise à jour locale
    }
  }
  
  previousDay() {
    if (this.currentDay > 1) {
      this.currentDay--;
      this.loadChallengesForDay();
      localStorage.setItem('currentDay', this.currentDay.toString()); // 🔥 Mise à jour locale
    }
  }  

  async presentLogoutAlert() {
    const alert = await this.alertController.create({
      header: 'Confirmation',
      message: 'Voulez-vous vous déconnecter ?',
      cssClass: 'custom-alert',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
          cssClass: 'alert-cancel',
          handler: () => console.log('Déconnexion annulée')
        },
        {
          text: 'Déconnexion',
          cssClass: 'alert-confirm',
          handler: () => this.logout()
        }
      ]
    });
    await alert.present();
  }

  get completedChallengesCount(): number {
    return this.currentDayChallenges.filter(d => d.completed).length;
  }

  private async logout() {
    try {
      await signOut(this.afAuth);
      this.router.navigateByUrl('/connexion');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  // Ajoute cette fonction dans Tab1Page
  async updateOtherTabs() {
    await this.storage.set('currentDay', this.currentDay);
    console.log("Jour mis à jour dans Storage:", this.currentDay);
  }
  

  goToProfilePage() {
    this.router.navigate(['/tabs/profil']);
  }
}
