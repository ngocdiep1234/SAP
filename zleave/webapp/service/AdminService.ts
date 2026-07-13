import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import { parseODataError } from "./LeaveRequestService";

/**
 * @namespace zleave.zleave.service
 */
export default class AdminService {
    private readonly _oModel: InstanceType<typeof ODataModel>;

    public constructor(oModel: InstanceType<typeof ODataModel>) {
        this._oModel = oModel;
    }

    /**
     * Activates an employee by EmployeeId.
     * 
     * @param sEmployeeId - Employee ID to activate
     * @returns Promise resolving on success
     */
    public activateEmployee(sEmployeeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._oModel.callFunction("/activate", {
                method: "POST",
                urlParameters: {
                    EmployeeId: sEmployeeId
                },
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Deactivates an employee by EmployeeId.
     * 
     * @param sEmployeeId - Employee ID to deactivate
     * @returns Promise resolving on success
     */
    public deactivateEmployee(sEmployeeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._oModel.callFunction("/deactivate", {
                method: "POST",
                urlParameters: {
                    EmployeeId: sEmployeeId
                },
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Creates a new EmployeeAdmin record.
     * 
     * @param oPayload - The employee data to create
     * @returns Promise resolving on success
     */
    public createEmployee(oPayload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._oModel.create("/EmployeeAdmin", oPayload, {
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Updates an existing EmployeeAdmin record.
     * 
     * @param sEmployeeId - The ID of the employee to update
     * @param oPayload - The employee data to update
     * @returns Promise resolving on success
     */
    public updateEmployee(sEmployeeId: string, oPayload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sPath = `/EmployeeAdmin(EmployeeId='${sEmployeeId}')`;
            this._oModel.update(sPath, oPayload, {
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Reads AuditLog entities from `/AuditLog`.
     * 
     * @param mParams - Read parameters (urlParameters, filters, sorters etc)
     * @returns Promise resolving with the results list
     */
    public readAuditLogs(mParams?: any): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            this._oModel.read("/AuditLog", {
                ...mParams,
                success: (oData: { results: any[] }): void => {
                    resolve(oData.results ?? []);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Creates a new LeaveTypeAdmin record.
     * 
     * @param oPayload - Leave Type payload
     * @returns Promise resolving on success
     */
    public createLeaveType(oPayload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._oModel.create("/LeaveTypeAdmin", oPayload, {
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Updates an existing LeaveTypeAdmin record.
     * 
     * @param sLeaveTypeId - The Leave Type ID to update
     * @param oPayload - Leave Type payload
     * @returns Promise resolving on success
     */
    public updateLeaveType(sLeaveTypeId: string, oPayload: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sPath = `/LeaveTypeAdmin(LeaveTypeId='${sLeaveTypeId}')`;
            this._oModel.update(sPath, oPayload, {
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Deletes a LeaveTypeAdmin record by LeaveTypeId.
     * 
     * @param sLeaveTypeId - The Leave Type ID to delete
     * @returns Promise resolving on success
     */
    public deleteLeaveType(sLeaveTypeId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sPath = `/LeaveTypeAdmin(LeaveTypeId='${sLeaveTypeId}')`;
            this._oModel.remove(sPath, {
                success: (): void => {
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }
}
