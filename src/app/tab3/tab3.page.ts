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
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false
})
export class Tab3Page implements OnInit, OnDestroy {
  employe: any = null;
  formation: any = null;
  currentDay: number = 1;
  dayChanged: boolean = false;
  citation: string = '';
  astuce: string = '';
  isLoading: boolean = true;
  
  // Initialisation explicite pour TypeScript
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
      // Charger le jour depuis le stockage avec fallback
      const storedDay = await this.storage.get('currentDay');
      const localDay = localStorage.getItem('currentDay');
      this.currentDay = storedDay ?? (localDay ? parseInt(localDay) : 1);
      
      await this.loadUserData();
    } catch (error) {
      console.error('Initialization error:', error);
      this.isLoading = false;
    }
  }

  private setupSyncListeners() {
    // 1. Écouteur pour les changements cross-tabs
    this.storageListener = () => {
      const newDay = localStorage.getItem('currentDay');
      if (newDay) {
        this.handleDayUpdate(parseInt(newDay));
      }
    };
    window.addEventListener('storage', this.storageListener);

    // 2. Écouteur pour le même onglet
    this.dayChangeListener = ((event: DayChangedEvent) => {
      if (event.detail?.day !== this.currentDay) {
        this.handleDayUpdate(event.detail.day);
      }
    }) as EventListener;
    window.addEventListener('dayChanged', this.dayChangeListener);
  }

  private cleanupSyncListeners() {
    window.removeEventListener('storage', this.storageListener);
    window.removeEventListener('dayChanged', this.dayChangeListener);
  }

  private async handleDayUpdate(newDay: number) {
    if (newDay === this.currentDay) return;

    this.dayChanged = true;
    this.currentDay = newDay;
    this.isLoading = true;
    this.citation = '';
    this.astuce = '';

    try {
      // Sauvegarder le nouveau jour
      await this.storage.set('currentDay', newDay);
      
      // Recharger les données
      await this.loadUserData();
    } catch (error) {
      console.error('Day update error:', error);
    } finally {
      setTimeout(() => {
        this.dayChanged = false;
        this.isLoading = false;
      }, 500);
    }
  }

  private async loadUserData() {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        this.isLoading = false;
        return;
      }

      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${user.uid}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          this.employe = employeSnap.data();
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
      this.formation = formationSnap.docs[0].data();
      this.updateDayData();
    }
  }

  private updateDayData() {
    if (this.formation?.defis?.[this.currentDay - 1]) {
      const dayData = this.formation.defis[this.currentDay - 1];
      this.citation = dayData.citation || '';
      this.astuce = dayData.astuce || '';
    } else {
      this.citation = '';
      this.astuce = '';
    }
  }
}