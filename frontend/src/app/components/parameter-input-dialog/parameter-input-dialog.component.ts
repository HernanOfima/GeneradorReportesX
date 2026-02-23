import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Report, ReportParameter } from '../../models/report.models';

export interface DialogData {
  report: Report;
  parameters: ReportParameter[];
  initialValues?: { [key: string]: any };
}

@Component({
  selector: 'app-parameter-input-dialog',
  templateUrl: './parameter-input-dialog.component.html',
  styleUrls: ['./parameter-input-dialog.component.scss']
})
export class ParameterInputDialogComponent implements OnInit {
  parameterForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<ParameterInputDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private fb: FormBuilder
  ) {
    this.parameterForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    const formControls: { [key: string]: any } = {};

    this.data.parameters.forEach(param => {
      const validators = param.isRequired ? [Validators.required] : [];
      const initialValue = this.getInitialValue(param);
      
      // Set default values based on parameter type
      let defaultValue = initialValue ?? param.defaultValue;
      if (defaultValue === null || defaultValue === undefined || defaultValue === '') {
        defaultValue = this.getDefaultValue(param);
      }

      formControls[param.name] = [defaultValue, validators];
    });

    this.parameterForm = this.fb.group(formControls);
  }

  private getDefaultValue(param: ReportParameter): any {
    switch (param.dataType.toLowerCase()) {
      case 'datetime':
        return param.name.includes('Actual') ? new Date() : null;
      case 'int32':
      case 'int':
        return 0;
      case 'decimal':
        return 0.0;
      case 'boolean':
      case 'bool':
        return false;
      default:
        return '';
    }
  }

  private getInitialValue(param: ReportParameter): any {
    if (!this.data.initialValues) {
      return null;
    }

    const initialValues = this.data.initialValues;
    const nameWithAt = param.name.startsWith('@') ? param.name : `@${param.name}`;
    const nameWithoutAt = param.name.startsWith('@') ? param.name.slice(1) : param.name;

    const rawValue = initialValues[param.name] ?? initialValues[nameWithAt] ?? initialValues[nameWithoutAt];
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    if (this.isDateParameter(param)) {
      if (rawValue instanceof Date) {
        return rawValue;
      }

      const rawText = String(rawValue).trim();
      if (/^\d{8}$/.test(rawText)) {
        const year = Number(rawText.substring(0, 4));
        const month = Number(rawText.substring(4, 6)) - 1;
        const day = Number(rawText.substring(6, 8));
        return new Date(year, month, day);
      }

      const parsedDate = new Date(rawText);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    return rawValue;
  }

  isDateParameter(param: ReportParameter): boolean {
    return param.dataType.toLowerCase() === 'datetime';
  }

  isNumberParameter(param: ReportParameter): boolean {
    const dataType = param.dataType.toLowerCase();
    return ['int32', 'int', 'decimal'].includes(dataType) && !this.isGuidParameter(param);
  }

  isBooleanParameter(param: ReportParameter): boolean {
    return ['boolean', 'bool'].includes(param.dataType.toLowerCase());
  }

  isGuidParameter(param: ReportParameter): boolean {
    const dataType = param.dataType.toLowerCase();
    const name = param.name.toLowerCase();

    return dataType === 'guid'
      || dataType === 'uuid'
      || dataType === 'uniqueidentifier'
      || name.includes('idempresa')
      || name.includes('empresaid');
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.parameterForm.valid) {
      const formValue = this.parameterForm.value;
      
      // Convert form values to appropriate types
      const parameters: { [key: string]: any } = {};
      
      this.data.parameters.forEach(param => {
        let value = formValue[param.name];
        const dataType = param.dataType.toLowerCase();
        
        // Convert values based on parameter type
        if (this.isDateParameter(param) && value) {
          value = this.formatDateForApi(value);
        } else if (dataType === 'int32' || dataType === 'int') {
          const intValue = parseInt(value, 10);
          value = Number.isNaN(intValue) ? null : intValue;
        } else if (dataType === 'decimal') {
          const decimalValue = parseFloat(value);
          value = Number.isNaN(decimalValue) ? null : decimalValue;
        } else if (this.isGuidParameter(param) && typeof value === 'string') {
          value = value.trim();
        }
        
        // Use @ prefix format for parameter names as expected by API
        const parameterKey = param.name.startsWith('@') ? param.name : `@${param.name}`;
        parameters[parameterKey] = value;
      });

      this.dialogRef.close(parameters);
    }
  }

  getErrorMessage(paramName: string): string {
    const control = this.parameterForm.get(paramName);
    if (control?.hasError('required')) {
      return 'Este campo es requerido';
    }
    return '';
  }

  private formatDateForApi(value: unknown): string | null {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  }
}
