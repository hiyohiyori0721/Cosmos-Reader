package com.epub.reader;

import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        // 在 load()（bridge 创建）之前注册音量键开关插件
        registerPlugin(VolumeKeyPlugin.class);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        // 仅当“音量键翻页”开启时拦截音量键并转发为 JS 事件；
        // 关闭时恢复正常系统音量键（不拦截）
        if (VolumeKeyPlugin.isEnabled() && event.getAction() == KeyEvent.ACTION_DOWN) {
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
