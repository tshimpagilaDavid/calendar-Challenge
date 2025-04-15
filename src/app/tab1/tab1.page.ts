import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged, User, signOut } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Firestore, doc, collection, getDocs, getDoc, query, where } from '@angular/fire/firestore';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false
})
export class Tab1Page implements OnInit {
  // Variables d'état
  connected: boolean = false;
  employe: any = null;
  formation: any = null;
  currentDay: number = 1;
  currentDayChallenges: Array<{ description: string; completed: boolean }> = [];
  isLoading: boolean = true;

  constructor(
    private router: Router,
    private afAuth: Auth,
    private alertController: AlertController,
    private firestore: Firestore,
    private storage: Storage
  ) {
    this.initializeApp();
  }

  async ngOnInit() {
    await this.loadInitialData();
  }

  private async initializeApp() {
    await this.storage.create();
    this.checkAuthState();
  }

  private async loadInitialData() {
    try {
      await this.loadSavedDay();
      const user = this.afAuth.currentUser;
      if (user) {
        await this.loadUserData(user.uid);
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.isLoading = false;
    }
  }

  private async loadSavedDay() {
    try {
      const savedDay = await this.storage.get('currentDay');
      if (savedDay !== null) {
        this.currentDay = savedDay;
        console.log('Loaded day from storage:', this.currentDay);
      }
    } catch (error) {
      console.error('Error loading day:', error);
      this.currentDay = 1;
    }
  }

  private checkAuthState() {
    onAuthStateChanged(this.afAuth, async (user: User | null) => {
      this.connected = !!user;
      if (!user) {
        this.isLoading = false;
        return;
      }
      await this.loadUserData(user.uid);
    });
  }

  private async loadUserData(userId: string) {
    try {
      this.isLoading = true;
      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${userId}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          this.employe = employeSnap.data();
          await this.loadCurrentFormation(employeRef);
          break;
        }
      }
    } catch (error) {
      console.error("Data loading error:", error);
    } finally {
      this.isLoading = false;
    }
  }

  private async loadCurrentFormation(employeRef: any) {
    const formationsRef = collection(employeRef, 'formations');
    const q = query(formationsRef, where('statut', '==', 'En cours'));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      this.formation = querySnapshot.docs[0].data();
      this.formation.id = querySnapshot.docs[0].id;
      this.updateChallengesForCurrentDay();
    }
  }

  private updateChallengesForCurrentDay() {
    if (!this.formation?.defis?.[this.currentDay - 1]) {
      this.currentDayChallenges = [];
      return;
    }

    const dayData = this.formation.defis[this.currentDay - 1];
    this.currentDayChallenges = dayData.defis?.map((challenge: string) => ({
      description: challenge,
      completed: false
    })) || [];
  }

  // Nouvelle méthode de synchronisation améliorée
  private async syncDayChange(newDay: number) {
    // 1. Sauvegarde locale
    this.currentDay = newDay;
    
    // 2. Persistance dans Ionic Storage
    await this.storage.set('currentDay', newDay);
    
    // 3. Synchronisation cross-tabs via localStorage
    localStorage.setItem('currentDay', newDay.toString());
    localStorage.setItem('daySyncTrigger', Date.now().toString());
    
    // 4. Notification pour le même onglet
    window.dispatchEvent(new CustomEvent('dayChanged', {
      detail: { day: newDay }
    }));
    
    console.log('Day changed to:', newDay);
  }

  async changeDay(newDay: number) {
    if (newDay < 1 || newDay > this.formation?.defis?.length) return;

    this.isLoading = true;
    try {
      await this.syncDayChange(newDay);
      this.updateChallengesForCurrentDay();
    } catch (error) {
      console.error('Day change error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async nextDay() {
    if (this.formation && this.currentDay < this.formation.defis.length) {
      await this.changeDay(this.currentDay + 1);
    }
  }

  async previousDay() {
    if (this.currentDay > 1) {
      await this.changeDay(this.currentDay - 1);
    }
  }

  // Gestion de la déconnexion
  async logout() {
    try {
      await signOut(this.afAuth);
      await this.router.navigateByUrl('/connexion');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  }

  async presentLogoutAlert() {
    const alert = await this.alertController.create({
      header: 'Confirmation',
      message: 'Voulez-vous vous déconnecter ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Déconnexion', handler: () => this.logout() }
      ]
    });
    await alert.present();
  }

  get completedChallengesCount(): number {
    return this.currentDayChallenges.filter(c => c.completed).length;
  }

  goToProfilePage() {
    this.router.navigate(['/tabs/profil']);
  }
}