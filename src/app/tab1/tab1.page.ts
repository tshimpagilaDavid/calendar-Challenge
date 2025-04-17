import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class Tab1Page implements OnInit, OnDestroy {
  // Variables d'état
  connected: boolean = false;
  employe: any = null;
  formation: any = null;
  currentDay: number = 1;
  currentDayChallenges: Array<{ description: string; completed: boolean }> = [];
  isLoading: boolean = true;
  hasData: boolean = false;
  private authUnsubscribe: () => void = () => {};
  private dataTimeout: any = null;

  constructor(
    private router: Router,
    private afAuth: Auth,
    private alertController: AlertController,
    private firestore: Firestore,
    private storage: Storage
  ) {}

  async ngOnInit() {
    await this.initializeApp();
    this.loadInitialData();
  }

  ngOnDestroy() {
    this.authUnsubscribe();
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
    }
  }

  private async initializeApp() {
    await this.storage.create();
    this.authUnsubscribe = onAuthStateChanged(this.afAuth, this.handleAuthState.bind(this));
  }

  private async loadInitialData() {
    try {
      this.isLoading = true;
      this.hasData = false;
      
      // Timeout pour éviter un chargement trop long
      this.dataTimeout = setTimeout(() => {
        if (this.isLoading) {
          this.handleDataLoadComplete(false);
        }
      }, 8000); // 8 secondes timeout

      await this.loadSavedDay();
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.loadUserData(user.uid);
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.handleDataLoadComplete(false);
    }
  }

  private handleAuthState(user: User | null) {
    this.connected = !!user;
    if (!user) {
      this.handleDataLoadComplete(false);
      return;
    }
    this.loadUserData(user.uid);
  }

  private async loadSavedDay() {
    try {
      const savedDay = await this.storage.get('currentDay');
      if (savedDay !== null) {
        this.currentDay = savedDay;
      }
    } catch (error) {
      console.error('Error loading day:', error);
      this.currentDay = 1;
    }
  }

  private async loadUserData(userId: string) {
    try {
      this.isLoading = true;
      this.hasData = false;
      
      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      let dataFound = false;
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${userId}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          this.employe = employeSnap.data();
          await this.loadCurrentFormation(employeRef);
          dataFound = true;
          break;
        }
      }
      
      this.handleDataLoadComplete(dataFound);
    } catch (error) {
      console.error("Data loading error:", error);
      this.handleDataLoadComplete(false);
    }
  }

  private async loadCurrentFormation(employeRef: any) {
    try {
      const formationsRef = collection(employeRef, 'formations');
      const q = query(formationsRef, where('statut', '==', 'En cours'));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        this.formation = querySnapshot.docs[0].data();
        this.formation.id = querySnapshot.docs[0].id;
        this.updateChallengesForCurrentDay();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Formation loading error:", error);
      return false;
    }
  }

  private updateChallengesForCurrentDay() {
    if (!this.formation?.defis?.[this.currentDay - 1]) {
      this.currentDayChallenges = [];
      this.hasData = false;
      return;
    }

    const dayData = this.formation.defis[this.currentDay - 1];
    this.currentDayChallenges = dayData.defis?.map((challenge: string) => ({
      description: challenge,
      completed: false
    })) || [];
    
    this.hasData = this.currentDayChallenges.length > 0;
  }

  private async syncDayChange(newDay: number) {
    if (newDay === this.currentDay) return;
    
    this.isLoading = true;
    this.currentDay = newDay;
    
    try {
      await this.storage.set('currentDay', newDay);
      localStorage.setItem('currentDay', newDay.toString());
      window.dispatchEvent(new CustomEvent('dayChanged', {
        detail: { day: newDay }
      }));
      
      this.updateChallengesForCurrentDay();
    } catch (error) {
      console.error('Day sync error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private handleDataLoadComplete(success: boolean) {
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
      this.dataTimeout = null;
    }
    
    this.hasData = success;
    this.isLoading = false;
    
    if (!success) {
      this.currentDayChallenges = [];
    }
  }

  async changeDay(newDay: number) {
    if (newDay < 1 || newDay > (this.formation?.defis?.length || 0)) return;
    await this.syncDayChange(newDay);
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

  async reloadData() {
    this.isLoading = true;
    this.hasData = false;
    const user = await this.afAuth.currentUser;
    if (user) {
      await this.loadUserData(user.uid);
    } else {
      this.handleDataLoadComplete(false);
    }
  }

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