using System;
using Tizen.NUI;
using Tizen.NUI.BaseComponents;

namespace {{project_name_underscore}}
{
    public class Program : NUIApplication
    {
         Animation animation;
        protected override void OnCreate()
        {
            base.OnCreate();
            Window window = Window.Instance;
            window.BackgroundColor = Color.Blue;
            window.KeyEvent += OnKeyEvent;

            XamlPage page = new XamlPage();
            page.PositionUsesPivotPoint = true;
            page.ParentOrigin = ParentOrigin.Center;
            page.PivotPoint = PivotPoint.Center;
            page.Size = new Size(window.WindowSize);
            window.Add(page);

            animation = new Animation(2000);
            animation.AnimateTo(page.text, "Orientation", new Rotation(new Radian(new Degree(180.0f)), PositionAxis.X), 0, 500);
            animation.AnimateTo(page.text, "Orientation", new Rotation(new Radian(new Degree(0.0f)), PositionAxis.X), 500, 1000);
            animation.Looping = true;
            animation.Play();
        }

        public void OnKeyEvent(object sender, Window.KeyEventArgs e)
        {
            if (e.Key.State == Key.StateType.Down && (e.Key.KeyPressedName == "XF86Back" || e.Key.KeyPressedName == "Escape"))
            {
                Exit();
            }
        }

        static void Main(string[] args)
        {
            var app = new Program();
            app.Run(args);
        }
    }
}
