import { Component, OnInit } from '@angular/core';
import { Firestore, collection, doc, getDocs, getDoc, query, where } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  employe: any = null;
  formation: any = null;
  currentDay: number = 1;
  citation: string = '';
  astuce: string = '';
  isLoading: boolean = true;

  constructor(private firestore: Firestore, private afAuth: Auth) {
    this.checkAuthState();
  }

  ngOnInit() {
    // 🔥 Écoute des changements de currentDay toutes les 500ms
    setInterval(() => {
      const storedDay = localStorage.getItem('currentDay');
      if (storedDay && parseInt(storedDay, 10) !== this.currentDay) {
        this.currentDay = parseInt(storedDay, 10);
        this.loadDayData();
      }
    }, 500);
  }

  private checkAuthState() {
    onAuthStateChanged(this.afAuth, async (user: User | null) => {
      if (user) {
        await this.getEmployeData(user.uid);
      } else {
        this.isLoading = false;
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
            this.loadDayData();
          }
          break;
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données:", error);
    } finally {
      this.isLoading = false;
    }
  }

  loadDayData() {
    if (this.formation && this.formation.defis && this.formation.defis[this.currentDay - 1]) {
      this.citation = this.formation.defis[this.currentDay - 1].citation || '';
      this.astuce = this.formation.defis[this.currentDay - 1].astuce || '';
    }
  }
}
