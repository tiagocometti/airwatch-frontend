import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GasThreshold } from '../../core/models/gas-threshold.model';

interface ZoneArc {
  path: string;
  color: string;
}

@Component({
  selector: 'app-gauge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gauge.component.html',
  styleUrl: './gauge.component.css'
})
export class GaugeComponent implements OnChanges {
  @Input() gasName: string = '';
  @Input() value: number = 0;
  @Input() threshold!: GasThreshold;
  @Input() unit: string = 'ppm';

  protected zones: ZoneArc[] = [];
  protected trackPath = '';
  protected needleRotation = 180;
  protected status = { label: 'Seguro', color: '#00e676' };
  protected gaugeMax = 0;

  private readonly cx = 100;
  private readonly cy = 115;
  private readonly outerR = 88;
  private readonly innerR = 62;
  private readonly needleLen = 55;

  get needleX2(): number { return this.cx + this.needleLen; }
  get dotCx(): number { return this.cx; }
  get dotCy(): number { return this.cy; }

  ngOnChanges() {
    if (!this.threshold) return;

    this.gaugeMax = this.threshold.alertMax * 1.5;
    this.trackPath = this.arcPath(0, 1, this.outerR, this.innerR);

    const { safeMax, goodMax, alertMax } = this.threshold;
    const max = this.gaugeMax;
    this.zones = [
      { from: 0,             to: safeMax / max,  color: '#00e676' },
      { from: safeMax / max, to: goodMax / max,  color: '#b8d400' },
      { from: goodMax / max, to: alertMax / max, color: '#ff9800' },
      { from: alertMax / max, to: 1,             color: '#ff5252' },
    ].map(z => ({ path: this.arcPath(z.from, z.to, this.outerR, this.innerR), color: z.color }));

    const f = Math.min(Math.max(this.value / this.gaugeMax, 0), 1);
    this.needleRotation = 180 + f * 180;

    if (this.value <= safeMax)  this.status = { label: 'Seguro', color: '#00e676' };
    else if (this.value <= goodMax)  this.status = { label: 'Bom',    color: '#b8d400' };
    else if (this.value <= alertMax) this.status = { label: 'Alerta', color: '#ff9800' };
    else                             this.status = { label: 'Perigo', color: '#ff5252' };
  }

  private arcPath(f1: number, f2: number, outerR: number, innerR: number): string {
    const pt = (f: number, r: number) => {
      const a = (180 + f * 180) * Math.PI / 180;
      return { x: +(this.cx + r * Math.cos(a)).toFixed(3), y: +(this.cy + r * Math.sin(a)).toFixed(3) };
    };
    const s = pt(f1, outerR), e = pt(f2, outerR);
    const si = pt(f1, innerR), ei = pt(f2, innerR);
    const large = (f2 - f1) > 0.5 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${outerR} ${outerR} 0 ${large} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${innerR} ${innerR} 0 ${large} 0 ${si.x} ${si.y} Z`;
  }
}
