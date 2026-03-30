import {DateTime} from 'luxon';

export type ParsedFolder = {
    date: DateTime;
    title: string;
};

export const parse_folder_name = (name: string): ParsedFolder | null => {
    const parts = name.split(' ');
    if (parts.length < 2) {
        return null;
    }
    const [date_part, time_part] = parts[0].split('_');
    const date = DateTime.fromFormat(`${date_part} ${time_part}`, 'yyyy-MM-dd HHmm');
    return {
        date,
        title: parts.slice(1).join(' '),
    };
};
