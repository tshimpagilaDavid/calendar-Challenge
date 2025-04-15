import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Storage } from '@ionic/storage-angular';

interface DayChangedEvent extends Event {
  detail: {
    day: number;
  };
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false
})
export class Tab2Page implements OnInit, OnDestroy {
  currentDay: number = 1;
  specialDefi: string = '';
  isLoading: boolean = true;
  dayChanged: boolean = false;
  
  // Initialisation explicite pour résoudre TS2564
  private storageListener: (() => void) = () => {};
  private dayChangeListener: EventListener = () => {};

  constructor(
    private firestore: Firestore,
    private afAuth: Auth,
    private storage: Storage
  ) {}

  async ngOnInit() {
    await this.initializeData();
    this.setupSyncListeners();
  }

  ngOnDestroy() {
    this.cleanupSyncListeners();
  }

  private async initializeData() {
    try {
      // Charger le jour depuis le stockage avec fallback sécurisé
      const storedDay = await this.storage.get('currentDay');
      const localDay = localStorage.getItem('currentDay');
      
      this.currentDay = storedDay ?? (localDay ? parseInt(localDay) : 1);
      
      // Charger les données si utilisateur connecté
      const user = await this.afAuth.currentUser;
      if (user) {
        await this.loadUserData(user.uid);
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.isLoading = false;
    }
  }

  private setupSyncListeners() {
    // 1. Écouteur pour localStorage (cross-tabs)
    this.storageListener = () => {
      const newDay = localStorage.getItem('currentDay');
      if (newDay) {
        this.handleDayUpdate(parseInt(newDay));
      }
    };
    window.addEventListener('storage', this.storageListener);

    // 2. Écouteur custom pour le même onglet
    this.dayChangeListener = ((event: DayChangedEvent) => {
      if (event.detail?.day !== this.currentDay) {
        this.handleDayUpdate(event.detail.day);
      }
    }) as EventListener;
    
    window.addEventListener('dayChanged', this.dayChangeListener);
  }

  private cleanupSyncListeners() {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
    if (this.dayChangeListener) {
      window.removeEventListener('dayChanged', this.dayChangeListener);
    }
  }

  private async handleDayUpdate(newDay: number) {
    if (newDay === this.currentDay) return;

    this.dayChanged = true;
    this.currentDay = newDay;
    this.isLoading = true;
    this.specialDefi = '';

    try {
      // Sauvegarder le nouveau jour
      await this.storage.set('currentDay', newDay);
      
      // Recharger les données
      await this.loadSpecialChallenge();
    } catch (error) {
      console.error('Day update error:', error);
    } finally {
      setTimeout(() => {
        this.dayChanged = false;
        this.isLoading = false;
      }, 500);
    }
  }

  private async loadUserData(userId: string) {
    try {
      this.isLoading = true;
      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${userId}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          await this.loadFormationData(employeRef);
          break;
        }
      }
    } catch (error) {
      console.error("User data error:", error);
    }
  }

  private async loadFormationData(employeRef: any) {
    const formationsRef = collection(employeRef, 'formations');
    const q = query(formationsRef, where('statut', '==', 'En cours'));
    const formationSnap = await getDocs(q);
    
    if (!formationSnap.empty) {
      await this.loadSpecialChallenge();
    }
  }

  async loadSpecialChallenge() {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) return;

      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${user.uid}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          const formationsRef = collection(employeRef, 'formations');
          const q = query(formationsRef, where('statut', '==', 'En cours'));
          const formationSnap = await getDocs(q);
          
          if (!formationSnap.empty) {
            const formation = formationSnap.docs[0].data();
            const dayIndex = this.currentDay - 1;
            
            if (formation['defis']?.[dayIndex]?.specialDefi) {
              this.specialDefi = formation['defis'][dayIndex].specialDefi;
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error("Challenge loading error:", error);
    }
  }
}