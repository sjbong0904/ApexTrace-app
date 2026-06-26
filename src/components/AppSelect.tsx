import type { ReactNode, SelectHTMLAttributes } from 'react';
import { FaChevronDown } from 'react-icons/fa';

interface AppSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    sizeVariant?: 'sm' | 'md';
    children: ReactNode;
}

const AppSelect = ({ sizeVariant = 'md', className = '', children, ...props }: AppSelectProps) => {
    const sizeClass = sizeVariant === 'sm' ? 'app-select--sm' : 'app-select--md';

    return (
        <div className="app-select-wrap">
            <select
                className={`app-select ${sizeClass}${className ? ` ${className}` : ''}`}
                {...props}
            >
                {children}
            </select>
            <FaChevronDown className="app-select-wrap__icon" size={10} aria-hidden />
        </div>
    );
};

export default AppSelect;
