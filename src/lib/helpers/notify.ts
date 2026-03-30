import {
    isPermissionGranted,
    requestPermission,
    sendNotification,
} from '@tauri-apps/plugin-notification';

export const notify = async (body: string) => {
    let permission = await isPermissionGranted();
    console.log('permission:', permission);
    if (!permission) {
        console.log('permission apres requete:', permission);
        permission = (await requestPermission()) === 'granted';
    }
    if (permission) {
        sendNotification({title: 'Plume', body});
    }
};
