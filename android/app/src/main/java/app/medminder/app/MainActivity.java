package app.medminder.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Fit content below system bars. Android 15+ defaults to edge-to-edge; without this,
 * CSS safe-area env() is often 0 in the WebView and auth UI sits under the status bar.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
  }
}
