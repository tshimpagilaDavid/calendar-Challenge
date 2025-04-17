import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Storage } from '@ionic/storage-angular';
import { ToastController } from '@ionic/angular';

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
  hasData: boolean = false;
  
  private storageListener: () => void = () => {};
  private dayChangeListener: EventListener = () => {};
  private dataTimeout: any = null;
  private lastLoadedDay: number | null = null;

  constructor(
    private firestore: Firestore,
    private afAuth: Auth,
    private storage: Storage,
    private alertController: ToastController
  ) {}

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
      // Chargement optimisé du jour courant
      const [storedDay, localDay] = await Promise.all([
        this.storage.get('currentDay'),
        localStorage.getItem('currentDay')
      ]);
      
      this.currentDay = storedDay ?? (localDay ? parseInt(localDay) : 1);
      
      // Timeout pour éviter un chargement trop long
      this.dataTimeout = setTimeout(() => {
        if (this.isLoading) {
          this.handleDataLoadComplete(false);
        }
      }, 8000); // 8 secondes timeout

      await this.loadDataForCurrentUser();
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
    if (newDay === this.currentDay || newDay === this.lastLoadedDay) return;

    this.dayChanged = true;
    this.currentDay = newDay;
    this.isLoading = true;
    this.hasData = false;
    this.specialDefi = '';

    try {
      await Promise.all([
        this.storage.set('currentDay', newDay),
        this.loadDataForCurrentUser()
      ]);
    } catch (error) {
      console.error('Day update error:', error);
      this.handleDataLoadComplete(false);
    }
  }

  private async loadDataForCurrentUser() {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        this.handleDataLoadComplete(false);
        return;
      }

      const entreprisesSnapshot = await getDocs(collection(this.firestore, 'entreprises'));
      
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        const employeRef = doc(this.firestore, `entreprises/${entrepriseDoc.id}/employes/${user.uid}`);
        const employeSnap = await getDoc(employeRef);
        
        if (employeSnap.exists()) {
          await this.loadFormationData(employeRef);
          this.lastLoadedDay = this.currentDay;
          return;
        }
      }
      
      this.handleDataLoadComplete(false);
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
        const formation = formationSnap.docs[0].data();
        const dayIndex = this.currentDay - 1;
        
        if (formation['defis']?.[dayIndex]?.specialDefi) {
          this.specialDefi = formation['defis'][dayIndex].specialDefi;
          this.handleDataLoadComplete(true);
        } else {
          this.handleDataLoadComplete(false);
        }
      } else {
        this.handleDataLoadComplete(false);
      }
    } catch (error) {
      console.error("Formation data error:", error);
      this.handleDataLoadComplete(false);
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
      this.specialDefi = '';
    }
    
    setTimeout(() => {
      this.dayChanged = false;
    }, 500);
  }

  async reloadData() {
    this.isLoading = true;
    this.hasData = false;
    await this.loadDataForCurrentUser();
  }

  // Ajoutez ces méthodes à votre classe Tab2Page
async markAsCompleted() {
  // Implémentez la logique pour marquer le défi comme terminé
  const alert = await this.alertController.create({
    header: 'Défi terminé',
    message: 'Voulez-vous marquer ce défi comme terminé?',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Confirmer',
        handler: () => {
          // Logique de mise à jour Firestore
          this.presentSuccessToast();
        }
      }
    ]
  });
  await alert.present();
}

private async presentSuccessToast() {
  const toast = await this.alertController.create({
    message: 'Défi marqué comme terminé!',
    duration: 2000,
    color: 'success'
  });
  await toast.present();
}
}