import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth'; // Importez onAuthStateChanged

@Component({
  selector: 'app-profil',
  templateUrl: './profil.page.html',
  styleUrls: ['./profil.page.scss'],
  standalone: false
})
export class ProfilPage implements OnInit {
  employee: any = null; // Objet pour stocker les données de l'employé
  isLoading: boolean = true; // Pour gérer l'état de chargement

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private auth: Auth // Injection du service d'authentification
  ) {}

  async ngOnInit() {
    // Écouter les changements d'état d'authentification
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        // Si un utilisateur est connecté, récupérer ses données
        await this.loadEmployeeData(user.uid);
      } else {
        // Si aucun utilisateur n'est connecté
        console.error("Aucun utilisateur connecté");
        this.isLoading = false;
      }
    });
  }

  async loadEmployeeData(employeeId: string) {
    this.isLoading = true; // Activer le chargement
    this.employee = null; // Réinitialiser les données de l'employé

    try {
      // Référence à la collection "entreprises"
      const entreprisesCollectionRef = collection(this.firestore, 'entreprises');

      // Récupérer tous les documents de la collection "entreprises"
      const entreprisesSnapshot = await getDocs(entreprisesCollectionRef);

      // Parcourir chaque entreprise
      for (const entrepriseDoc of entreprisesSnapshot.docs) {
        // Référence à la sous-collection "employes" de l'entreprise actuelle
        const employesCollectionRef = collection(entrepriseDoc.ref, 'employes');

        // Récupérer le document spécifique à l'employé par son UID
        const employeDocRef = doc(employesCollectionRef, employeeId);
        const employeDoc = await getDoc(employeDocRef);

        if (employeDoc.exists()) {
          this.employee = employeDoc.data(); // Stocker les données de l'employé
          break; // Sortir de la boucle dès que l'employé est trouvé
        }
      }

      // Si aucun employé n'a été trouvé
      if (!this.employee) {
        console.error('Aucun employé trouvé avec cet ID');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des données :', error);
    } finally {
      this.isLoading = false; // Désactiver le chargement
    }
  }
}