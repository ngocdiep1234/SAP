import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import { parseODataError } from "./LeaveRequestService";

export interface EmployeeEntry {
    EmployeeId: string;
    FullName: string;
    SapUserName: string;
    Email?: string;
    Department?: string;
    PositionTitle?: string;
    ManagerSapUser?: string;
    IsManager?: string;
    IsHR?: string;
    IsAdmin?: string;
}

/**
 * @namespace zleave.zleave.service
 */
export default class EmployeeService {
    private readonly _oModel: InstanceType<typeof ODataModel>;

    public constructor(oModel: InstanceType<typeof ODataModel>) {
        this._oModel = oModel;
    }

    /**
     * Reads all employees from /Employee entity set.
     * 
     * @returns Promise resolving with an array of EmployeeEntry
     */
    public readEmployees(): Promise<EmployeeEntry[]> {
        return new Promise<EmployeeEntry[]>((resolve, reject) => {
            this._oModel.read("/Employee", {
                success: (oData: { results: EmployeeEntry[] }): void => {
                    resolve(oData.results ?? []);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Reads team employees for a given manager's SAP User Name from /Employee.
     *
     * @param sManagerSapUser - The manager's SAP User Name.
     * @returns Promise resolving with an array of team EmployeeEntry items.
     */
    public readTeamEmployees(sManagerSapUser: string): Promise<EmployeeEntry[]> {
        return new Promise<EmployeeEntry[]>((resolve, reject) => {
            this._oModel.read("/Employee", {
                filters: [
                    new Filter("ManagerSapUser", FilterOperator.EQ, sManagerSapUser)
                ],
                success: (oData: { results: EmployeeEntry[] }): void => {
                    resolve(oData.results ?? []);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Queries /Employee by SapUserName.
     * 
     * @param sSapUser - The SAP User Name to search for
     * @returns Promise resolving with EmployeeEntry or null if not found
     */
    public getEmployeeBySapUser(sSapUser: string): Promise<EmployeeEntry | null> {
        return new Promise<EmployeeEntry | null>((resolve, reject) => {
            this._oModel.read("/Employee", {
                filters: [
                    new Filter("SapUserName", FilterOperator.EQ, sSapUser)
                ],
                success: (oData: { results: EmployeeEntry[] }): void => {
                    const aResults = oData.results || [];
                    if (aResults.length > 0) {
                        resolve(aResults[0]);
                    } else {
                        resolve(null);
                    }
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }
}
