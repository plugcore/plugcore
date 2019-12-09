import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule, MatCardModule, MatInputModule, MatSelectModule } from '@angular/material';
import { MembershipUsersUpdateComponent } from '../components/update.component';
import { MembershipUsersUpdateRoutesModule } from './update.routes.module';

@NgModule({
	imports: [
		CommonModule,
		MembershipUsersUpdateRoutesModule,
		ReactiveFormsModule,
		MatInputModule,
		MatButtonModule,
		MatSelectModule,
		MatCardModule
	],
	declarations: [
		MembershipUsersUpdateComponent
	]
})
export class MembershipUsersUpdateModule {}