using System;
using Tizen.Applications;
using Tizen.NUI;
using Tizen.NUI.BaseComponents;

namespace {{project_name_underscore}}
{
    public class {{project_name_underscore}} : NUIGadget
    {
        public {{project_name_underscore}}() : base(NUIGadgetType.Normal)
        {
        }

        protected override View OnCreate()
        {
            base.OnCreate();

            TextLabel text = new TextLabel("Hello Tizen NUI Gadget");
            text.BackgroundColor = Color.Blue;
            text.HorizontalAlignment = HorizontalAlignment.Center;
            text.VerticalAlignment = VerticalAlignment.Center;
            text.TextColor = Color.White;
            text.PointSize = 12.0f;
            text.HeightResizePolicy = ResizePolicyType.FillToParent;
            text.WidthResizePolicy = ResizePolicyType.FillToParent;
            return text;
        }

        protected override void OnAppControlReceived(AppControlReceivedEventArgs e)
        {
            base.OnAppControlReceived(e);
        }

        protected override void OnPause()
        {
            base.OnPause();
            MainView.Hide();
        }

        protected override void OnResume()
        {
            base.OnResume();
            MainView.Show();
        }

        protected override void OnDestroy()
        {
            base.OnDestroy();
        }

        protected override void OnDeviceOrientationChanged(DeviceOrientationEventArgs e)
        {
            base.OnDeviceOrientationChanged(e);
        }

        protected override void OnLocaleChanged(LocaleChangedEventArgs e)
        {
            base.OnLocaleChanged(e);
        }

        protected override void OnLowBattery(LowBatteryEventArgs e)
        {
            base.OnLowBattery(e);
        }

        protected override void OnLowMemory(LowMemoryEventArgs e)
        {
            base.OnLowMemory(e);
        }

        protected override void OnRegionFormatChanged(RegionFormatChangedEventArgs e)
        {
            base.OnRegionFormatChanged(e);
        }
    }
}
