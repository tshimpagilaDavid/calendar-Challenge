import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Storage } from '@ionic/storage-angular';
import { Location } from '@angular/common';


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
  hasData: boolean = false;
  
  private storageListener: (() => void) = () => {};
  private dayChangeListener: EventListener = () => {};
  private dataTimeout: any = null;

  constructor(
    private firestore: Firestore,
    private afAuth: Auth,
    private storage: Storage,
    private location: Location
  ) {}

  goBack() {
    this.location.back();
  }

  async ngOnInit() {
    await this.initializeData();
    this.setupSyncListeners();
  }

  ngOnDestroy() {
    this.cleanupSyncListeners();
    if (this.dataTimeout) {
      clearTimeout(this.dataTimeout);
    }
  }

  private async initializeData() {
    try {
      const storedDay = await this.storage.get('currentDay');
      const localDay = localStorage.getItem('currentDay');
      this.currentDay = storedDay ?? (localDay ? parseInt(localDay) : 1);
      
      // Timeout pour éviter un chargement trop long
      this.dataTimeout = setTimeout(() => {
        if (this.isLoading) {
          this.isLoading = false;
          this.hasData = false;
        }
      }, 5000); // 5 secondes timeout

      await this.loadUserData();
    } catch (error) {
      console.error('Initialization error:', error);
      this.handleDataLoadComplete(false);
    }
  }

  private setupSyncListeners() {
    this.storageListener = () => {
      const newDay = localStorage.getItem('currentDay');
      if (newDay) {
        this.handleDayUpdate(parseInt(newDay));
      }
    };
    window.addEventListener('storage', this.storageListener);

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
    this.hasData = false;
    this.citation = '';
    this.astuce = '';

    try {
      await this.storage.set('currentDay', newDay);
      await this.loadUserData();
    } catch (error) {
      console.error('Day update error:', error);
      this.handleDataLoadComplete(false);
    }
  }

  private async loadUserData() {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        this.handleDataLoadComplete(false);
        return;
      }

      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      let found = false;
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${user.uid}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          this.employe = employeSnap.data();
          await this.loadFormationData(employeRef);
          found = true;
          break;
        }
      }

      if (!found) {
        this.handleDataLoadComplete(false);
      }
    } catch (error) {
      console.error("User data error:", error);
      this.handleDataLoadComplete(false);
    }
  }

  private async loadFormationData(employeRef: any) {
    try {
      const formationsRef = collection(employeRef, 'formations');
      const q = query(formationsRef, where('statut', '==', 'En cours'));
      const formationSnap = await getDocs(q);
      
      if (!formationSnap.empty) {
        this.formation = formationSnap.docs[0].data();
        this.updateDayData();
        this.handleDataLoadComplete(true);
      } else {
        this.handleDataLoadComplete(false);
      }
    } catch (error) {
      console.error("Formation data error:", error);
      this.handleDataLoadComplete(false);
    }
  }

  private updateDayData() {
    if (this.formation?.defis?.[this.currentDay - 1]) {
      const dayData = this.formation.defis[this.currentDay - 1];
      this.citation = dayData.citation || '';
      this.astuce = dayData.astuce || '';
      this.hasData = true;
    } else {
      this.citation = '';
      this.astuce = '';
      this.hasData = false;
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
      this.citation = '';
      this.astuce = '';
    }
    
    setTimeout(() => {
      this.dayChanged = false;
    }, 500);
  }

  async reloadData() {
    this.isLoading = true;
    this.hasData = false;
    await this.loadUserData();
  }
}