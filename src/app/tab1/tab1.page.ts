import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged, User, signOut } from '@angular/fire/auth';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { Firestore, doc, collection, getDocs, getDoc, query, where } from '@angular/fire/firestore';
import { setDoc } from 'firebase/firestore';
import confetti from 'canvas-confetti';


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
  totalChallengesCompleted: number = 0;
  dailyProgress: { day: number, completed: number, total: number }[] = [];

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

  // Bascule l’état d’un défi (complété ou non) avec animation de confettis
async toggleChallenge(index: number) {
  const challenge = this.currentDayChallenges[index];
  const wasCompleted = challenge.completed;
  
  // Inverse l'état
  challenge.completed = !wasCompleted;

  // Déclenche les confettis uniquement quand on passe à "complété"
  if (!wasCompleted && challenge.completed) {
    this.fireCelebrationConfetti();
  }

  // Mettre à jour les statistiques et sauvegarder
  await this.updateProgressStats();
  await this.saveChallenges();

}

// Animation de confettis customisée
private fireCelebrationConfetti() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 }, // Position verticale (0.6 = bas de l'écran)
    colors: [
      '#d570fa', // Violet clair
      '#ff69b4', // Rose vif
      '#a18aff', // Lavande
      '#ffffff'  // Blanc
    ],
    shapes: ['circle', 'star'], // Formes variées
    scalar: 0.8 // Taille légèrement réduite
  });

  // Optionnel : Petite explosion supplémentaire après 300ms
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#ff69b4'],
      scalar: 0.5
    });
  }, 300);
}
  

  // Met à jour les statistiques de progression de la formation
async updateProgressStats() {
  const currentDayCompleted = this.currentDayChallenges.filter(c => c.completed).length;
  const currentDayTotal = this.currentDayChallenges.length;

  console.log(`Progression jour ${this.currentDay} :`, currentDayCompleted, '/', currentDayTotal);

  // Mettre à jour ou ajouter les statistiques du jour dans le tableau dailyProgress
  const dayIndex = this.dailyProgress.findIndex(d => d.day === this.currentDay);
  if (dayIndex >= 0) {
    this.dailyProgress[dayIndex] = {
      day: this.currentDay,
      completed: currentDayCompleted,
      total: currentDayTotal
    };
  } else {
    this.dailyProgress.push({
      day: this.currentDay,
      completed: currentDayCompleted,
      total: currentDayTotal
    });
  }

  // Met à jour le total des défis complétés sur toute la formation
  this.totalChallengesCompleted = this.dailyProgress.reduce((sum, day) => sum + day.completed, 0);
  console.log('Total complétés:', this.totalChallengesCompleted);

  // Sauvegarde dans Firestore après mise à jour des statistiques
  await this.saveChallenges();
}


  // Sauvegarde les défis et les statistiques dans Firestore
  async saveChallenges() {
    try {
      const user = await this.afAuth.currentUser;
      const entrepriseId = 'SING'; // À remplacer par une valeur dynamique
      const formationId = 'confiance-en-soi'; // À remplacer par une valeur dynamique
  
      if (user?.uid && entrepriseId && formationId) {
        const formationDocRef = doc(
          this.firestore,
          `entreprises/${entrepriseId}/employes/${user.uid}/formations/${formationId}`
        );
  
        const updatedData = {
          progress: {
            daily: this.dailyProgress,
            totalCompleted: this.totalChallengesCompleted,
            lastUpdated: new Date().toISOString()
          }
        };
  
        await setDoc(formationDocRef, updatedData, { merge: true });
        console.log('Progression sauvegardée avec succès:', updatedData);
      } else {
        console.error('Utilisateur ou formation non trouvée.');
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde dans Firestore:', error);
      throw error; // Pour diagnostiquer les erreurs
    }
  }

  // Calcule le nombre total de défis de la formation
  getTotalChallenges(): number {
    if (!this.formation?.defis) return 0;

    return this.formation.defis.reduce((total: number, day: any) => {
      return total + (day.defis?.length || 0);
    }, 0);
  }

  private async updateChallengesForCurrentDay() {
    if (!this.formation?.defis?.[this.currentDay - 1]) {
      this.currentDayChallenges = [];
      return;
    }
  
    const dayData = this.formation.defis[this.currentDay - 1];
  
    // Chercher la progression pour le jour courant dans dailyProgress
    const dayProgress = this.dailyProgress.find(d => d.day === this.currentDay) || {
      day: this.currentDay,
      completed: 0,
      total: dayData.defis.length
    };
  
    // Initialiser les défis avec leur état de complétion
    this.currentDayChallenges = dayData.defis.map((challenge: string, index: number) => ({
      description: challenge,
      completed: index < dayProgress.completed // Restaurer l'état complété
    }));
  
    // Mettre à jour les statistiques locales si nécessaire
    await this.updateProgressStats();
  }
  

  private async initializeApp() {
    await this.storage.create();
    this.authUnsubscribe = onAuthStateChanged(this.afAuth, this.handleAuthState.bind(this));
  }

  private async loadInitialData() {
    try {
      this.isLoading = true;
      this.hasData = false;
  
      // Charger le jour courant
      await this.loadSavedDay();
  
      // Charger les données utilisateur
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.loadUserData(user.uid);
      }
  
      // Mettre à jour les défis après avoir chargé toutes les données
      await this.updateChallengesForCurrentDay();
  
      this.handleDataLoadComplete(true);
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
        const formationDoc = querySnapshot.docs[0];
        this.formation = formationDoc.data();
        this.formation.id = formationDoc.id;
  
        // Charger la progression depuis Firestore
        const progressData = this.formation.progress || {};
        this.dailyProgress = progressData.daily || [];
        this.totalChallengesCompleted = progressData.totalCompleted || 0;
  
        // Mettre à jour les défis du jour courant
        await this.updateChallengesForCurrentDay();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Formation loading error:', error);
      return false;
    }
  }

  private async syncDayChange(newDay: number) {
    if (newDay === this.currentDay) return;
  
    this.isLoading = true;
    this.currentDay = newDay;
  
    try {
      await this.storage.set('currentDay', newDay);
      window.dispatchEvent(new CustomEvent('dayChanged', {
        detail: { day: newDay }
      }));
  
      await this.updateChallengesForCurrentDay();
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
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.loadUserData(user.uid);
        await this.updateChallengesForCurrentDay();
        this.handleDataLoadComplete(true);
      } else {
        this.handleDataLoadComplete(false);
      }
    } catch (error) {
      console.error('Reload error:', error);
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
