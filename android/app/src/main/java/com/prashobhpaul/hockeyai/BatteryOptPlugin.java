package com.prashobhpaul.hockeyai;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiny helper around Android battery-optimization exemption.
 *
 * Background result checks run through WorkManager (background-runner
 * plugin). On phones with aggressive battery savers — very common on
 * Xiaomi / Vivo / Oppo devices — those jobs get throttled or killed
 * unless the user whitelists the app. This plugin lets the web layer
 * (a) check whether the app is already exempt and (b) fire the system
 * dialog / settings screen that grants the exemption.
 */
@CapacitorPlugin(name = "BatteryOpt")
public class BatteryOptPlugin extends Plugin {

    @PluginMethod
    public void isIgnoring(PluginCall call) {
        boolean ignoring = true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            ignoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void request(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + ctx.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception first) {
            // Some OEM builds block the direct dialog; fall back to the
            // full battery-optimization settings list.
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                call.resolve();
            } catch (Exception second) {
                call.reject("Battery optimization settings unavailable on this device");
            }
        }
    }
}
