import type { Match } from '../types';
import { SHORT_WEAPON_NAMES } from '../utils/gameData';
import { useTranslation } from 'react-i18next';

const LoadoutDisplay = ({ match }: { match: Match }) => {
    const { t } = useTranslation();
    const loadout = match.loadout || { primary: null, secondary: null };

    const renderWeaponSlot = (weaponName: string | null, label: string) => {
        const isCompletelyEmpty = (
            !weaponName || 
            weaponName.trim() === '' || 
            weaponName.toLowerCase() === 'unknown'
        );

        if (isCompletelyEmpty) {
            return (
        <div style={{ flex: 1, background: 'var(--color-bg-card)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: '100%', fontSize: '9px', color: 'var(--color-text-faint)', fontWeight: 'bold', textAlign: 'left', marginBottom: '4px' }}>
                {label}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '40px' }}>
                <div style={{ color: 'var(--color-border)', fontSize: '11px', fontWeight: 'bold' }}>{t('loadout.noWeapon')}</div>
                    </div>
                </div>
            );
        }

        // ✅ 백엔드가 이미 정규화된 키를 저장하므로 재정규화 없이 직접 사용
        const fileKey = weaponName;

        // ✅ OFFICIAL_WEAPON_NAMES로 정확한 공식 무기명 우선 사용
        const displayName = SHORT_WEAPON_NAMES(weaponName)
            ?? weaponName.toUpperCase();

        return (
        <div style={{ flex: 1, background: 'var(--color-bg-card)', borderRadius: '8px', border: '1px solid var(--color-border)', padding: '8px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: '100%', fontSize: '9px', color: 'var(--color-text-faint)', fontWeight: 'bold', textAlign: 'left', marginBottom: '4px' }}>
                {label}
            </div>

                <div style={{ width: '100%', height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* ✅ knownShortName 조건 제거 — fileKey만 있으면 이미지 시도 */}
                    {fileKey ? (
                        <img
                            src={`https://ureuzkxyyozzzluzawwr.supabase.co/storage/v1/object/public/images/${fileKey}.png`}
                            alt={displayName}
                            title={displayName}
                            style={{ width: 'auto', maxWidth: '95%', height: 'auto', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))', transform: 'rotate(-5deg)' }}
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                if (target.parentElement) {
                                    target.parentElement.innerHTML = `<span style="color:var(--color-warning); font-size:10px; text-align:center; word-break:break-all; line-height:1.2;">${displayName}</span>`;
                                }
                            }}
                        />
                    ) : (
                        <span style={{ color: 'var(--color-warning)', fontSize: '10px', textAlign: 'center', wordBreak: 'break-all', lineHeight: '1.2' }}>
                            {displayName}
                        </span>
                    )}
                </div>

                {/* ✅ displayName으로 교체 */}
                <div style={{ marginTop: 'auto', fontSize: '10px', color: 'var(--color-text-secondary)', fontWeight: '700', letterSpacing: '0.5px', background: 'var(--color-bg-card)', padding: '2px 8px', borderRadius: '4px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayName}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '15px', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-sub-header)' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('loadout.title')}
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', flex: 1 }}>
                {renderWeaponSlot(loadout.primary, t('loadout.slot1'))}
                {renderWeaponSlot(loadout.secondary, t('loadout.slot2'))}
            </div>
        </div>
    );
};

export default LoadoutDisplay;