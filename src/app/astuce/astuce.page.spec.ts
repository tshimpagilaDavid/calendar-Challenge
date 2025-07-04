import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AstucePage } from './astuce.page';

describe('AstucePage', () => {
  let component: AstucePage;
  let fixture: ComponentFixture<AstucePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AstucePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
