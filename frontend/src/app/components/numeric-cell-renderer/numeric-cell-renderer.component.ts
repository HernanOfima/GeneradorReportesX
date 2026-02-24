import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { NumberFormatUtil } from '../../utils/number-format.util';

@Component({
  selector: 'app-numeric-cell-renderer',
  template: `<span class="numeric-cell">{{ formattedValue }}</span>`,
  styles: [`
    .numeric-cell {
      text-align: right;
      font-family: monospace;
      font-weight: 500;
    }
  `]
})
export class NumericCellRendererComponent implements ICellRendererAngularComp {
  formattedValue: string = '';

  agInit(params: ICellRendererParams): void {
    this.formattedValue = NumberFormatUtil.formatSpanishNumber(params.value);
  }

  refresh(params: ICellRendererParams): boolean {
    this.formattedValue = NumberFormatUtil.formatSpanishNumber(params.value);
    return true;
  }
}
