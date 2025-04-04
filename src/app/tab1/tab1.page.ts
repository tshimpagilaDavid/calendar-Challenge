import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged, User, signOut } from '@angular/fire/auth';
import { AlertController, LoadingController } from '@ionic/angular';
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

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false
})
export class Tab1Page implements OnInit {
  connected: boolean = false;
  employe: any = null;
  entrepriseNom: string = '';
  formation: any = null;
  currentDay: number = 1;
  currentDayChallenges: Array<{ description: string; completed: boolean }> = [];
  private _storage: Storage | null = null;
  isLoading: boolean = true;
  loading: HTMLIonLoadingElement | null = null;

  constructor(
    private router: Router,
    private afAuth: Auth,
    private alertController: AlertController,
    private firestore: Firestore,
    private storage: Storage,
    private loadingController: LoadingController
  ) {
    this.checkAuthState();
  }

  async ngOnInit() {
    await this.initStorage();
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

  private async showLoading() {
    this.loading = await this.loadingController.create({
      message: 'Chargement en cours...',
      spinner: 'crescent'
    });
    await this.loading.present();
  }

  private async dismissLoading() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
    this.isLoading = false;
  }

  private checkAuthState() {
    this.showLoading();
    onAuthStateChanged(this.afAuth, async (user: User | null) => {
      if (user) {
        this.connected = true;
        await this.getEmployeData(user.uid);
      } else {
        this.connected = false;
        this.dismissLoading();
      }
    });
  }

  private async getEmployeData(userId: string) {
    try {
      const entreprisesCollectionRef = collection(this.firestore, 'entreprises');
      const entreprisesSnapshot = await getDocs(entreprisesCollectionRef);
  
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const entrepriseId = entrepriseDoc.id;
        const employeDocRef = doc(this.firestore, `entreprises/${entrepriseId}/employes/${userId}`);
        const employeSnapshot = await getDoc(employeDocRef);
  
        if (employeSnapshot.exists()) {
          this.employe = employeSnapshot.data();
          
          const formationsRef = collection(employeDocRef, 'formations');
          const q = query(formationsRef, where('statut', '==', 'En cours'));
          const querySnapshot = await getDocs(q);
  
          if (!querySnapshot.empty) {
            this.formation = querySnapshot.docs[0].data();
            this.formation.id = querySnapshot.docs[0].id;
            this.loadChallengesForDay();
          }
          
          this.dismissLoading();
          return;
        }
      }
  
      console.error('Employé non trouvé dans aucune entreprise.');
      this.dismissLoading();
    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
      this.dismissLoading();
    }
  }  

  loadChallengesForDay() {
    if (this.formation && this.formation.defis && this.formation.defis[this.currentDay - 1]) {
      const dayData = this.formation.defis[this.currentDay - 1];
      if (dayData.defis && Array.isArray(dayData.defis)) {
        this.currentDayChallenges = dayData.defis.map((challenge: string) => ({
          description: challenge,
          completed: false
        }));
      } else {
        this.currentDayChallenges = [];
      }
    } else {
      this.currentDayChallenges = [];
    }
  }

  async nextDay() {
    if (this.formation && this.formation.defis && this.currentDay < this.formation.defis.length) {
      this.currentDay++;
      await this.updateOtherTabs();
      this.loadChallengesForDay();
    }
  }
  
  async previousDay() {
    if (this.currentDay > 1) {
      this.currentDay--;
      await this.updateOtherTabs();
      this.loadChallengesForDay();
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

  async updateOtherTabs() {
    if (this._storage) {
      await this._storage.set('currentDay', this.currentDay);
    }
  }
  
  goToProfilePage() {
    this.router.navigate(['/tabs/profil']);
  }
}