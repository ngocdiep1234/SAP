import ODataModel from "sap/ui/model/odata/v2/ODataModel";

// ---------------------------------------------------------------------------
// Entity interfaces – mirrors the OData metadata
// ---------------------------------------------------------------------------

/**
 * A single Leave Type entry from the /LeaveType EntitySet.
 */
export interface LeaveTypeEntry {
    LeaveType: string;
    LeaveName: string;
    IsPaid: boolean;
    MaxDays: number;
}

/**
 * The writable fields for creating a new LeaveRequest.
 * Read-only fields (UUID, RequestId, EmployeeId, TotalDays, Status, …)
 * are intentionally excluded – the backend derives them automatically.
 */
export interface LeaveRequestPayload {
    LeaveType: string;
    StartDate: Date;
    EndDate: Date;
    Reason: string;
    AttachmentUrl: string;
}

/**
 * Subset of the OData error response body.
 */
interface ODataErrorResponse {
    error?: {
        message?: {
            value?: string;
        };
        innererror?: {
            errordetails?: Array<{ message: string }>;
        };
    };
}

// ---------------------------------------------------------------------------
// Helper – parse OData error body to a human-readable string
// ---------------------------------------------------------------------------

/**
 * Attempts to extract the most descriptive error message from an OData V2
 * error response object. Falls back to a generic string if parsing fails.
 *
 * @param oErr - The raw error object passed to the OData error callback.
 * @returns A human-readable error message.
 */
export function parseODataError(oErr: { responseText?: string; message?: string }): string {
    if (oErr.responseText) {
        try {
            const oParsed = JSON.parse(oErr.responseText) as ODataErrorResponse;
            const sMsg = oParsed?.error?.message?.value;
            if (sMsg) {
                return sMsg;
            }
            const aDetails = oParsed?.error?.innererror?.errordetails;
            if (aDetails && aDetails.length > 0) {
                return aDetails.map((d) => d.message).join("; ");
            }
        } catch {
            // JSON parse failed – fall through to generic message
        }
    }
    return oErr.message ?? "An unexpected error occurred. Please try again.";
}

// ---------------------------------------------------------------------------
// LeaveRequestService
// ---------------------------------------------------------------------------

/**
 * @namespace zleave.zleave.service
 *
 * LeaveRequestService
 * ===================
 * Encapsulates all OData V2 operations related to the Leave Request domain.
 * Controllers call the public methods and receive typed Promises – they do
 * not need to know about the OData API surface.
 */
export default class LeaveRequestService {

    private readonly _oModel: InstanceType<typeof ODataModel>;

    /**
     * @param oModel - The application's default OData V2 model.
     */
    public constructor(oModel: InstanceType<typeof ODataModel>) {
        this._oModel = oModel;
    }

    // -----------------------------------------------------------------------
    // LeaveType – value help
    // -----------------------------------------------------------------------

    /**
     * Reads all entries from the /LeaveType EntitySet.
     *
     * @returns A Promise that resolves with an array of LeaveTypeEntry objects.
     */
    public readLeaveTypes(): Promise<LeaveTypeEntry[]> {
        return new Promise<LeaveTypeEntry[]>((resolve, reject) => {
            this._oModel.read("/LeaveType", {
                success: (oData: { results: LeaveTypeEntry[] }): void => {
                    resolve(oData.results ?? []);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    // -----------------------------------------------------------------------
    // LeaveRequest – create
    // -----------------------------------------------------------------------

    /**
     * Creates a new LeaveRequest entry via OData V2 POST.
     *
     * Only the writable fields defined in LeaveRequestPayload are sent.
     * The backend computes UUID, RequestId, TotalDays, Status, etc.
     *
     * @param oPayload - The leave request data to submit.
     * @returns A Promise that resolves when the create succeeds or rejects
     *          with a human-readable error string.
     */
    public createLeaveRequest(oPayload: LeaveRequestPayload): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._oModel.create("/LeaveRequest", oPayload, {
                success: (): void => {
                    // Refresh the model cache so other views see the new entry.
                    try {
                        this._oModel.refresh(true);
                    } catch {
                        // Non-fatal – navigation will reload data anyway.
                    }
                    resolve();
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }
}
