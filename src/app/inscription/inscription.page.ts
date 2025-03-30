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
  selector: 'app-inscription',
  templateUrl: './inscription.page.html',
  styleUrls: ['./inscription.page.scss'],
  standalone: false,
})
export class InscriptionPage implements OnInit {

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

   async signUp() {
    try {
      if (this.dataUser.email && this.dataUser.password) {
        const { user } = await createUserWithEmailAndPassword(
          this.Auth,
          this.dataUser.email,
          this.dataUser.password
        );
        await this.presentToast('Utilisateur enregistré avec succès', 'success');
  
        if (user) {
          await setDoc(doc(this.firestore, 'users', user.uid), {
            author: user.uid,
            displayName: this.dataUser.displayName,
            phoneNumber: this.dataUser.phoneNumber,
            email: this.dataUser.email,
            date: new Date().toISOString()
          });
          await this.presentToast('Informations de l\'utilisateur enregistrées avec succès dans Firestore.', 'success');
        }
        this.dataUser = {
          displayName: '',
          email: '',
          password: '',
          phoneNumber: '',
          entreprise:''
        };
      } else {
        await this.presentToast('Veuillez saisir une adresse e-mail et un mot de passe.', 'warning');
      }
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/email-already-in-use') {
          await this.presentToast('Cette adresse e-mail est déjà utilisée.', 'danger');
        } else if (error.code === 'auth/weak-password') {
          await this.presentToast('Le mot de passe est trop faible. Doit contenir 6 caractère ou plus', 'danger');
        } else {
          await this.presentToast('Erreur lors de l\'inscription : ' + error.message, 'danger');
        }
      } else {
        await this.presentToast('Une erreur inconnue est survenue.', 'danger');
      }
    }
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
