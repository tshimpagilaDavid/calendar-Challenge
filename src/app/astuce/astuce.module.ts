import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AstucePageRoutingModule } from './astuce-routing.module';

import { AstucePage } from './astuce.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AstucePageRoutingModule
  ],
  declarations: [AstucePage]
})
export class AstucePageModule {}
