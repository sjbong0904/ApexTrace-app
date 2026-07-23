type Props = {
    open: boolean;
    title: string;
    summary: unknown;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function ConfirmModal({ open, title, summary, busy, onCancel, onConfirm }: Props) {
    if (!open) return null;
    return (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
                <h3 style={{ marginTop: 0 }}>{title}</h3>
                <p className="muted">이 작업은 되돌리기 어려울 수 있습니다. 최종 확인 후에만 적용됩니다.</p>
                <pre>{typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2)}</pre>
                <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
                    <button type="button" className="secondary" onClick={onCancel} disabled={busy}>
                        취소
                    </button>
                    <button type="button" className="danger" onClick={onConfirm} disabled={busy}>
                        {busy ? '적용 중…' : '최종 확인'}
                    </button>
                </div>
            </div>
        </div>
    );
}
