package com.epub.reader;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 音量键翻页开关桥：JS 侧同步“音量键翻页”开关状态，
 * 原生 MainActivity 仅在开启时拦截音量键（关闭时恢复正常系统音量键）。
 */
@CapacitorPlugin(name = "VolumeKey")
public class VolumeKeyPlugin extends Plugin {

    private static boolean enabled = true;

    /** 供 MainActivity.dispatchKeyEvent 判断是否拦截音量键 */
    public static boolean isEnabled() {
        return enabled;
    }

    /** JS 调用：Capacitor.Plugins.VolumeKey.setEnabled({ enabled: true|false }) */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean v = call.getBoolean("enabled");
        enabled = (v != null) && v;
        call.resolve(new JSObject().put("enabled", enabled));
    }
}
