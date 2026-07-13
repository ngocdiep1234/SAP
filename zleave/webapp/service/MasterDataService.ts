import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import { parseODataError } from "./LeaveRequestService";

export interface LeaveQuota {
    LeaveTypeName: string;
    RemainingDays: number;
    UsedDays: number;
    TotalDays: number;
    EmployeeId?: string;
}

/**
 * @namespace zleave.zleave.service
 */
export default class MasterDataService {
    private readonly _oModel: InstanceType<typeof ODataModel>;

    public constructor(oModel: InstanceType<typeof ODataModel>) {
        this._oModel = oModel;
    }

    /**
     * Reads leave quota from /LeaveQuota. Optional filter by EmployeeId.
     * 
     * @param sEmployeeId - Optional Employee ID to filter by
     * @returns Promise resolving with an array of LeaveQuota
     */
    public readLeaveQuota(sEmployeeId?: string): Promise<LeaveQuota[]> {
        const mParameters: any = {};
        if (sEmployeeId) {
            mParameters.filters = [
                new Filter("EmployeeId", FilterOperator.EQ, sEmployeeId)
            ];
        }

        return new Promise<LeaveQuota[]>((resolve, reject) => {
            this._oModel.read("/LeaveQuota", {
                ...mParameters,
                success: (oData: { results: LeaveQuota[] }): void => {
                    resolve(oData.results ?? []);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }
}
