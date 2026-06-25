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
 * A single Manager entry from the /ZI_MANAGER_VH EntitySet.
 */
export interface ManagerEntry {
    ManagerUser: string;
    ManagerName: string;
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
    ApproverId: string;
    StartSession?: string;
    EndSession?: string;
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
    // Manager – value help
    // -----------------------------------------------------------------------

    /**
     * Reads all entries from the /ZI_MANAGER_VH EntitySet.
     *
     * @returns A Promise that resolves with an array of ManagerEntry objects.
     */
    public readManagers(): Promise<ManagerEntry[]> {
        return new Promise<ManagerEntry[]>((resolve, reject) => {
            this._oModel.read("/ZI_MANAGER_VH", {
                success: (oData: { results: ManagerEntry[] }): void => {
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
    public createLeaveRequest(oPayload: LeaveRequestPayload): Promise<{ UUID: string }> {
        return new Promise<{ UUID: string }>((resolve, reject) => {
            this._oModel.create("/LeaveRequest", oPayload, {
                success: (oData: any): void => {
                    // NOTE: Do NOT call refresh(true) here — it can invalidate the CSRF token
                    // before the subsequent file upload PUT request. Refresh happens after upload.
                    resolve(oData);
                },
                error: (oErr: { responseText?: string; message?: string }): void => {
                    reject(parseODataError(oErr));
                }
            });
        });
    }

    /**
     * Uploads a file associated with a LeaveRequest.
     *
     * @param sUuid - The UUID of the LeaveRequest.
     * @param oFile - The File object to upload.
     * @returns A Promise that resolves when the upload succeeds or rejects with an error message.
     */
    public uploadAttachment(sUuid: string, oFile: File): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const oModel = this._oModel;
            let sServiceUrl = (oModel as any).sServiceUrl as string || "";
            if (sServiceUrl.endsWith("/")) {
                sServiceUrl = sServiceUrl.slice(0, -1);
            }
            const sUrl = `${sServiceUrl}/LeaveRequest(guid'${sUuid}')/$value`;

            // Use getSecurityToken() directly – same as RequestDetail.onUploadAttachment
            const sToken = oModel.getSecurityToken() || "";

            const xhr = new XMLHttpRequest();
            xhr.open("PUT", sUrl, true);
            xhr.setRequestHeader("x-csrf-token", sToken);
            xhr.setRequestHeader("Slug", oFile.name);
            if (oFile.type) {
                xhr.setRequestHeader("Content-Type", oFile.type);
            }

            xhr.onload = (): void => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // ── Mirror RequestDetail: update FileName & MimeType via OData model ──
                    oModel.update(`/LeaveRequest(guid'${sUuid}')`, {
                        FileName: oFile.name,
                        MimeType: oFile.type || ""
                    }, {
                        success: (): void => {
                            resolve();
                        },
                        error: (oErr: { responseText?: string; message?: string }): void => {
                            // File was uploaded; metadata update failed – non-fatal, resolve anyway
                            console.warn("[LeaveRequestService] File uploaded but metadata update failed:", parseODataError(oErr));
                            resolve();
                        }
                    });
                } else {
                    reject(`Upload failed — HTTP ${xhr.status} ${xhr.statusText}. URL: ${sUrl}`);
                }
            };

            xhr.onerror = (): void => {
                reject(`Upload failed due to a network error. URL: ${sUrl}`);
            };

            xhr.send(oFile);
        });
    }


}
