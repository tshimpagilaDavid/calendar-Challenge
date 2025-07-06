import { Component, OnInit, OnDestroy } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, setDoc, where } from '@angular/fire/firestore';
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
  defiCompleted: boolean = false;

  
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
      const formationId = 'confiance-en-soi';
      const formationDocRef = doc(employeRef, `formations/${formationId}`);
      const formationSnap = await getDoc(formationDocRef);
  
      if (!formationSnap.exists()) {
        this.handleDataLoadComplete(false);
        return;
      }
  
      const formation = formationSnap.data();
      const dayIndex = this.currentDay - 1;
  
      const defiData = formation['defis']?.[dayIndex];
      const progress = formation['progress']?.daily || [];
  
      // ✅ Lire la complétion depuis progress.daily
      const progressDay = progress.find((d: any) => d.day === this.currentDay);
  
      this.specialDefi = defiData?.specialDefi || '';
      this.defiCompleted = !!(progressDay && progressDay.completed === 1);
  
      this.handleDataLoadComplete(!!this.specialDefi);
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
    const alert = await this.alertController.create({
      header: 'Défi terminé',
      message: 'Voulez-vous marquer ce défi comme terminé ?',
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel'
        },
        {
          text: 'Confirmer',
          handler: async () => {
            await this.saveDefiCompletion();
            this.defiCompleted = true;
            this.presentSuccessToast();
          }
        }
      ]
    });
    await alert.present();
  }

  async saveDefiCompletion() {
    try {
      const user = await this.afAuth.currentUser;
      const entrepriseId = 'SING';
      const formationId = 'confiance-en-soi';
  
      if (!user?.uid) {
        console.error('Utilisateur non connecté');
        return;
      }
  
      const formationDocRef = doc(
        this.firestore,
        `entreprises/${entrepriseId}/employes/${user.uid}/formations/${formationId}`
      );
  
      // Lire les données actuelles
      const formationSnap = await getDoc(formationDocRef);
      const existingData = formationSnap.exists() ? formationSnap.data() : {};
  
      const previousDaily = existingData?.['progress']?.daily || [];
  
      // Mettre à jour la progression
      const updatedDaily = [...previousDaily];
      const index = updatedDaily.findIndex(d => d.day === this.currentDay);
  
      const updatedDay = {
        day: this.currentDay,
        completed: 1, // un seul défi spécial, donc 1 si terminé
        total: 1
      };
  
      if (index !== -1) {
        updatedDaily[index] = updatedDay;
      } else {
        updatedDaily.push(updatedDay);
      }
  
      const updateData = {
        progress: {
          daily: updatedDaily,
          totalCompleted: (existingData?.['progress']?.totalCompleted || 0) + 1,
          lastUpdated: new Date().toISOString()
        }
      };
  
      await setDoc(formationDocRef, updateData, { merge: true });
      console.log('Défi du jour sauvegardé:', updateData);
    } catch (error) {
      console.error('Erreur de sauvegarde du défi:', error);
    }
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