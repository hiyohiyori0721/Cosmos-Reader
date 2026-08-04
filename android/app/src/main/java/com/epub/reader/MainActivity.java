package com.epub.reader;

import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // 音量键翻页：Android 硬件音量键不会产生 WebView 键盘事件，
        // 在原生层拦截并转发为 JS 事件（JS 侧根据“音量键翻页”开关决定是否翻页）
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_UP) {
                getBridge().triggerDocumentJSEvent("volumeUp");
                return true;
            } else if (event.getKeyCode() == KeyEvent.KEYCODE_VOLUME_DOWN) {
                getBridge().triggerDocumentJSEvent("volumeDown");
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }
}
