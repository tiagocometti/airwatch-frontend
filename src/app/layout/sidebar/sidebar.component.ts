import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: SafeHtml;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  expanded = signal(true);
  navItems: NavItem[];

  constructor(public auth: AuthService, private sanitizer: DomSanitizer) {
    const svg = (path: string) => sanitizer.bypassSecurityTrustHtml(
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`
    );

    this.navItems = [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>')
      },
      {
        path: '/sensors',
        label: 'Dispositivos',
        icon: svg('<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>')
      },
      {
        path: '/measurements',
        label: 'Medições',
        icon: svg('<polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>')
      }
    ];
  }

  initials() {
    const name = this.auth.user()?.userName || '';
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  }
}
