import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AstucePage } from './astuce.page';

const routes: Routes = [
  {
    path: '',
    component: AstucePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AstucePageRoutingModule {}
