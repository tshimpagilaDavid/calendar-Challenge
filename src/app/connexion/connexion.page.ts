import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { Firestore, setDoc, doc, getDoc } from '@angular/fire/firestore';
import { Auth, User, onAuthStateChanged, signInWithPopup, FacebookAuthProvider, GoogleAuthProvider, UserCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';
import * as firebase from 'firebase/app'; 
import 'firebase/auth';
import { ToastController } from '@ionic/angular';
import { FirebaseError } from 'firebase/app';

@Component({
  selector: 'app-connexion',
  templateUrl: './connexion.page.html',
  styleUrls: ['./connexion.page.scss'],
  standalone: false,
})
export class ConnexionPage implements OnInit {

  showPassword = false;
  dataUser = {
    displayName: '',
    email: '',
    password:'',
    phoneNumber:'',
    entreprise:''
  };
  connected!: boolean;

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  constructor(
    private firestore: Firestore,
    private menu: MenuController,
    private router: Router,
    private Auth: Auth,
    private toastController: ToastController
  ) {
    onAuthStateChanged(this.Auth, (user) => {
      if (!user) {
        console.log('Non connecté');
        this.connected = false;          
        if (this.menu) {
          this.menu.close();    
        }
      } else {
        console.log('Connecté: ' + user.uid);
        this.router.navigateByUrl('/tabs');
        this.connected = true;
      }
    });
   }

   async login() {
    try {
      if (this.dataUser.email && this.dataUser.password) {
        const isEmailFormat = this.isValidEmail(this.dataUser.email);
  
        if (isEmailFormat) {
          const credential: UserCredential = await signInWithEmailAndPassword(
            this.Auth,
            this.dataUser.email,
            this.dataUser.password
          );
          await this.presentToast('Connexion réussie !', 'success');
        } else {
          await this.presentToast('Le nom d\'utilisateur ne peut pas être utilisé pour la connexion. Veuillez utiliser une adresse e-mail.', 'warning');
        }
        this.dataUser = {
          displayName: '',
          email: '',
          password: '',
          phoneNumber: '',
    entreprise:''
        };
      } else {
        await this.presentToast('Veuillez saisir votre adresse e-mail et votre mot de passe.', 'warning');
      }
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/user-not-found':
            await this.presentToast('Aucun utilisateur trouvé avec cette adresse e-mail.', 'danger');
            break;
          case 'auth/wrong-password':
            await this.presentToast('Mot de passe incorrect.', 'danger');
            break;
          case 'auth/invalid-email':
            await this.presentToast('Adresse e-mail invalide.', 'danger');
            break;
          case 'auth/too-many-requests':
            await this.presentToast('Trop de tentatives de connexion. Veuillez réessayer plus tard.', 'danger');
            break;
          default:
            await this.presentToast('Erreur lors de la connexion : ' + error.message, 'danger');
        }
      } else {
        await this.presentToast('Une erreur inconnue est survenue.', 'danger');
      }
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3500,
      color: color,
      position: 'top'
    });
    toast.present();
  }

  ngOnInit() {
  }

}
